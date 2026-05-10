"use client";

import { useEffect, useRef, useState } from "react";
import { useAssetsStore } from "@/lib/ativos-store";
import { useMacro } from "@/lib/api";
import { ativosKpis, byAssetClass, byMarket } from "@/lib/ativos-derive";
import { exportCsv, importCsv } from "@/lib/ativos-csv";
import { fetchQuote, QuoteNotFoundError } from "@/lib/quotes";
import { ASSET_CLASS_META } from "@/lib/ativos-schema";
import {
  isB3PositionHeader,
  isB3MovementsHeader,
  isB3NegociacaoHeader,
  isB3EventsHeader,
  parseB3Position,
  parseB3Movements,
  parseB3Negociacao,
  parseB3Events,
  computeAverageCost,
  type ParsedB3Position,
  type B3Trade,
  type B3ScheduledEvent,
} from "@/lib/b3-import";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { AssetsTable } from "./AssetsTable";
import { AssetDialog } from "./AssetDialog";
import { KpiRowAtivos } from "./KpiRowAtivos";
import { ByAssetClassCard } from "./ByAssetClassCard";
import { ByMarketCard } from "./ByMarketCard";
import { ScheduledEventsBanner } from "./ScheduledEventsBanner";
import type { AssetPosition } from "@/lib/ativos-schema";

type SheetSlice = { name: string; rows: (string | number | null)[][] };

async function fileToSheets(file: File): Promise<SheetSlice[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as (string | number | null)[][],
    }));
  }
  const text = await file.text();
  const Papa = (await import("papaparse")).default;
  const rows = Papa.parse<string[]>(text, { skipEmptyLines: false }).data;
  return [{ name: "default", rows }];
}

async function handleB3Import(
  files: File[],
  existing: AssetPosition[],
  upsert: (p: Omit<AssetPosition, "color"> & { color?: string }) => void,
  replaceScheduledEvents: (events: B3ScheduledEvent[]) => void,
): Promise<void> {
  const positions: ParsedB3Position[] = [];
  const trades: B3Trade[] = [];
  const events: B3ScheduledEvent[] = [];
  const brokers = new Set<string>();
  let earliestDate: string | null = null;
  const errors: string[] = [];
  const recognizedSheets: string[] = [];

  for (const file of files) {
    let sheets: SheetSlice[];
    try {
      sheets = await fileToSheets(file);
    } catch (e) {
      errors.push(`${file.name}: erro ao ler (${e instanceof Error ? e.message : "desconhecido"})`);
      continue;
    }
    for (const sheet of sheets) {
      const header = sheet.rows[0]?.map((c) => (typeof c === "string" ? c.trim() : ""));
      if (!header) continue;
      if (isB3PositionHeader(header)) {
        const r = parseB3Position(sheet.rows, sheet.name);
        positions.push(...r.positions);
        r.brokers.forEach((b) => brokers.add(b));
        r.errors.forEach((e) => errors.push(`${file.name}/${sheet.name}: ${e.message}`));
        if (r.positions.length > 0) recognizedSheets.push(`${sheet.name} (${r.positions.length})`);
      } else if (isB3NegociacaoHeader(header)) {
        // Negociação is preferred when present — cleaner trade-only history.
        const r = parseB3Negociacao(sheet.rows);
        trades.push(...r.trades);
        if (r.earliestDate && (!earliestDate || r.earliestDate < earliestDate)) earliestDate = r.earliestDate;
        r.errors.forEach((e) => errors.push(`${file.name}/${sheet.name}: ${e.message}`));
        if (r.trades.length > 0) recognizedSheets.push(`Negociação (${r.trades.length} trades)`);
      } else if (isB3MovementsHeader(header)) {
        const r = parseB3Movements(sheet.rows);
        trades.push(...r.trades);
        if (r.earliestDate && (!earliestDate || r.earliestDate < earliestDate)) earliestDate = r.earliestDate;
        r.errors.forEach((e) => errors.push(`${file.name}/${sheet.name}: ${e.message}`));
        if (r.trades.length > 0) recognizedSheets.push(`Movimentação (${r.trades.length} trades)`);
      } else if (isB3EventsHeader(header)) {
        const r = parseB3Events(sheet.rows);
        events.push(...r.events);
        r.errors.forEach((e) => errors.push(`${file.name}/${sheet.name}: ${e.message}`));
        if (r.events.length > 0) recognizedSheets.push(`Eventos (${r.events.length} agendados)`);
      }
    }
  }

  if (positions.length === 0 && events.length === 0 && trades.length === 0) {
    alert(
      `Nenhum dado reconhecido.${errors.length ? "\n\n" + errors.join("\n") : ""}\n\n` +
      `Esperado: arquivo de Posição (Minha Carteira → Investimentos), Movimentação, Negociação ou Eventos (Extratos).`,
    );
    return;
  }

  const avgCosts = computeAverageCost(trades);
  const positionsWithRealAvg = positions.filter((p) => avgCosts.has(p.ticker)).length;

  // Heuristic: if we have movements but the earliest is < 2 years ago, history
  // is probably truncated. Warn the user so they can re-export with a larger range.
  let historyWarning = "";
  if (trades.length > 0 && earliestDate) {
    const earliest = new Date(earliestDate);
    const monthsSpan = (Date.now() - earliest.getTime()) / (30 * 24 * 3600 * 1000);
    if (monthsSpan < 24) {
      historyWarning =
        `\n\n⚠ Movimentação cobre só ${Math.round(monthsSpan)} meses (desde ${earliestDate}). ` +
        `Compras anteriores não estão refletidas no preço médio. ` +
        `Re-exporte com data inicial mais antiga pra precisão maior.`;
    }
  }

  const totalScheduledIncome = events.reduce((sum, e) => sum + e.netValue, 0);
  const eventsLine = events.length > 0
    ? `\nRenda agendada: R$ ${totalScheduledIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em ${events.length} pagamento(s) futuro(s)`
    : "";

  const summary =
    `Importar dados da B3?\n\n` +
    `Sheets reconhecidos: ${recognizedSheets.join(", ") || "—"}\n` +
    `Brokers: ${Array.from(brokers).join(", ") || "—"}\n` +
    (positions.length > 0
      ? `Posições: ${positions.length} (com preço médio real: ${positionsWithRealAvg})\n` +
        `Posições sem histórico de compra: avgPrice = preço de fechamento.`
      : `Sem novo arquivo de Posição — posições atuais serão preservadas.`) +
    eventsLine +
    historyWarning +
    (errors.length ? `\n\nAvisos:\n${errors.slice(0, 5).join("\n")}` : "");

  if (!confirm(summary)) return;

  if (events.length > 0) {
    replaceScheduledEvents(events);
  }

  for (const p of positions) {
    const existingPos = existing.find((x) => x.ticker === p.ticker);
    const meta = ASSET_CLASS_META[p.assetClass];
    const realAvg = avgCosts.get(p.ticker);
    // Trust B3's asset class — it's authoritative (sheet name on the export
    // tells us if a ticker is in Acoes, ETF, or Fundo de Investimento). When
    // the class changes, also reset currency/yield/capitalGain to the new
    // class defaults instead of carrying forward defaults that belonged to a
    // wrong classification.
    const classChanged = existingPos && existingPos.assetClass !== p.assetClass;
    upsert({
      id: existingPos?.id ?? crypto.randomUUID(),
      ticker: p.ticker,
      assetClass: p.assetClass,
      currency: "BRL",
      quantity: p.quantity,
      avgPrice: realAvg ?? existingPos?.avgPrice ?? p.closingPrice,
      currentPrice: p.closingPrice,
      asOf: p.asOf,
      expectedYield: classChanged ? meta.defaultYield : existingPos?.expectedYield ?? meta.defaultYield,
      capitalGain: classChanged ? meta.defaultCapitalGain : existingPos?.capitalGain ?? meta.defaultCapitalGain,
      color: existingPos?.color,
    });
  }
  const lines: string[] = [];
  if (positions.length > 0) lines.push(`${positions.length} posições importadas (${positionsWithRealAvg} com preço médio real)`);
  if (events.length > 0) lines.push(`${events.length} eventos agendados (R$ ${totalScheduledIncome.toFixed(2)})`);
  alert(lines.join("\n") || "Sem alterações.");
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AtivosPageContent() {
  const positions = useAssetsStore((s) => s.positions);
  const scheduledEvents = useAssetsStore((s) => s.scheduledEvents);
  const upsert = useAssetsStore((s) => s.upsertPosition);
  const remove = useAssetsStore((s) => s.removePosition);
  const replaceAll = useAssetsStore((s) => s.replaceAllPositions);
  const replaceScheduledEvents = useAssetsStore((s) => s.replaceScheduledEvents);
  const macro = useMacro();
  const fileRef = useRef<HTMLInputElement>(null);
  const b3FileRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "add" | "edit"; initial?: AssetPosition }>({
    open: false,
    mode: "add",
  });

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  if (!hydrated || macro.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
      </div>
    );
  }
  if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;

  const kpis = ativosKpis(positions, macro.data!);
  const groups = byAssetClass(positions, macro.data!);
  const split = byMarket(positions, macro.data!);

  return (
    <div className="space-y-6">
      <KpiRowAtivos kpis={kpis} />
      <ScheduledEventsBanner events={scheduledEvents} />
      <AssetsTable
        positions={positions}
        macro={macro.data!}
        onAdd={() => setDialog({ open: true, mode: "add" })}
        onEdit={(p) => setDialog({ open: true, mode: "edit", initial: p })}
        onDelete={remove}
        onImport={() => fileRef.current?.click()}
        onImportB3={() => b3FileRef.current?.click()}
        onExport={() => downloadFile(exportCsv(positions), "ativos.csv")}
        onRefreshQuote={async (p) => {
          try {
            const q = await fetchQuote(p.ticker, ASSET_CLASS_META[p.assetClass].market);
            upsert({ ...p, currentPrice: q.price, asOf: q.asOf });
          } catch (e) {
            const msg = e instanceof QuoteNotFoundError ? "Cotação não encontrada" : "Cotação indisponível";
            alert(`${p.ticker}: ${msg}`);
          }
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const result = await importCsv(file);
          if (result.errors.length === 0 && result.positions.length > 0) {
            replaceAll(result.positions);
            alert(`${result.positions.length} posições importadas.`);
          } else if (result.errors.length > 0) {
            const errorList = result.errors
              .slice(0, 5)
              .map((err) => `Linha ${err.row}: ${err.message}`)
              .join("\n");
            alert(`Erros na importação:\n${errorList}${result.errors.length > 5 ? "\n..." : ""}`);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={b3FileRef}
        type="file"
        accept=".csv,.xlsx"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length === 0) return;
          try {
            await handleB3Import(files, positions, upsert, replaceScheduledEvents);
          } finally {
            e.target.value = "";
          }
        }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ByAssetClassCard groups={groups} />
        <ByMarketCard split={split} macro={macro.data!} />
      </div>
      <AssetDialog
        open={dialog.open}
        mode={dialog.mode}
        initial={dialog.initial}
        onClose={() => setDialog({ open: false, mode: "add" })}
        onSubmit={(p) => {
          upsert(p);
          setDialog({ open: false, mode: "add" });
        }}
        onDelete={remove}
      />
    </div>
  );
}
