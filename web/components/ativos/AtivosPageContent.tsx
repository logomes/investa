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
  parseB3Position,
  parseB3Movements,
  computeAverageCost,
  type ParsedB3Position,
  type B3Trade,
} from "@/lib/b3-import";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { AssetsTable } from "./AssetsTable";
import { AssetDialog } from "./AssetDialog";
import { KpiRowAtivos } from "./KpiRowAtivos";
import { ByAssetClassCard } from "./ByAssetClassCard";
import { ByMarketCard } from "./ByMarketCard";
import type { AssetPosition } from "@/lib/ativos-schema";

async function fileToRows(file: File): Promise<(string | number | null)[][]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const readXlsx = (await import("read-excel-file/browser")).default;
    const rows = await readXlsx(file);
    return rows as unknown as (string | number | null)[][];
  }
  const text = await file.text();
  // Simple CSV split — papaparse handles quotes/embedded commas, but here we
  // can leverage its loaded form via the existing import. For B3 the rows
  // come from an XLSX → libreoffice CSV with comma sep and quoted fields.
  const Papa = (await import("papaparse")).default;
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return parsed.data;
}

async function handleB3Import(
  files: File[],
  existing: AssetPosition[],
  upsert: (p: Omit<AssetPosition, "color"> & { color?: string }) => void,
): Promise<void> {
  let positions: ParsedB3Position[] = [];
  let trades: B3Trade[] = [];
  let brokers: string[] = [];
  let earliestDate: string | null = null;
  const errors: string[] = [];

  for (const file of files) {
    let rows: (string | number | null)[][];
    try {
      rows = await fileToRows(file);
    } catch (e) {
      errors.push(`${file.name}: erro ao ler (${e instanceof Error ? e.message : "desconhecido"})`);
      continue;
    }
    const header = rows[0]?.map((c) => (typeof c === "string" ? c.trim() : ""));
    if (isB3PositionHeader(header)) {
      const r = parseB3Position(rows);
      positions = r.positions;
      brokers = r.brokers;
      r.errors.forEach((e) => errors.push(`${file.name}: ${e.message}`));
    } else if (isB3MovementsHeader(header)) {
      const r = parseB3Movements(rows);
      trades = r.trades;
      earliestDate = r.earliestDate;
      r.errors.forEach((e) => errors.push(`${file.name}: ${e.message}`));
    } else {
      errors.push(`${file.name}: formato não reconhecido (esperado Posição ou Movimentação da B3)`);
    }
  }

  if (positions.length === 0) {
    alert(
      `Nenhuma posição reconhecida.${errors.length ? "\n\n" + errors.join("\n") : ""}\n\n` +
      `Esperado: arquivo de Posição (Minha Carteira → Investimentos) e/ou Movimentação (Extratos).`,
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

  const summary =
    `Importar ${positions.length} posições da B3?\n\n` +
    `Brokers: ${brokers.join(", ") || "—"}\n` +
    `Posições com preço médio real (via Movimentação): ${positionsWithRealAvg}/${positions.length}\n` +
    `Posições sem histórico de compra: avgPrice = preço de fechamento (custo aproximado).\n\n` +
    `Posições já cadastradas (não-B3) serão preservadas.` +
    historyWarning +
    (errors.length ? `\n\nAvisos:\n${errors.slice(0, 5).join("\n")}` : "");

  if (!confirm(summary)) return;

  for (const p of positions) {
    const existingPos = existing.find((x) => x.ticker === p.ticker);
    const meta = ASSET_CLASS_META[p.assetClass];
    const realAvg = avgCosts.get(p.ticker);
    upsert({
      id: existingPos?.id ?? crypto.randomUUID(),
      ticker: p.ticker,
      assetClass: existingPos?.assetClass ?? p.assetClass,
      currency: "BRL",
      quantity: p.quantity,
      avgPrice: realAvg ?? existingPos?.avgPrice ?? p.closingPrice,
      currentPrice: p.closingPrice,
      asOf: p.asOf,
      expectedYield: existingPos?.expectedYield ?? meta.defaultYield,
      capitalGain: existingPos?.capitalGain ?? meta.defaultCapitalGain,
      color: existingPos?.color,
    });
  }
  alert(
    `${positions.length} posições importadas/atualizadas.\n` +
    `${positionsWithRealAvg} com preço médio real.`,
  );
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
  const upsert = useAssetsStore((s) => s.upsertPosition);
  const remove = useAssetsStore((s) => s.removePosition);
  const replaceAll = useAssetsStore((s) => s.replaceAllPositions);
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
      <div className="grid grid-cols-4 gap-4">
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
            await handleB3Import(files, positions, upsert);
          } finally {
            e.target.value = "";
          }
        }}
      />
      <div className="grid grid-cols-2 gap-6">
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
