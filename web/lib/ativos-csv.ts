import Papa from "papaparse";
import { assetPositionSchema, ASSET_CLASS_META } from "./ativos-schema";
import type { AssetPosition, AssetClass, Currency } from "./ativos-schema";

export type ImportError = { row: number; field?: string; message: string };
export type ImportResult = { positions: AssetPosition[]; errors: ImportError[] };

const HEADER = "Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital";

// Canonical labels are auto-derived from ASSET_CLASS_META so that adding a new
// AssetClass automatically gets its label recognized. Aliases below capture the
// short/legacy variants users may type by hand.
const LABEL_TO_CLASS: Record<string, AssetClass> = {
  ...Object.fromEntries(
    (Object.keys(ASSET_CLASS_META) as AssetClass[]).map(
      (cls) => [ASSET_CLASS_META[cls].label, cls],
    ),
  ),
  "FII Papel":             "FII_PAPEL",
  "FII Tijolo":             "FII_TIJOLO",
  "Ação BR Dividendo":     "ACAO_BR_DIVIDENDO",
  "Ação BR Crescimento":   "ACAO_BR_CRESCIMENTO",
};

function classToLabel(cls: AssetClass): string {
  return ASSET_CLASS_META[cls].label;
}

function parseBRNumber(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  // Accepts BR-canonical money form (1.234,56). Strip thousand separators '.', then convert decimal ',' → '.'.
  // Won't disambiguate US-decimal (100.50 typed by accident becomes 10050) — BR contract wins per CSV spec.
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function exportCsv(positions: AssetPosition[]): string {
  const BOM = "﻿";
  const lines = positions.map((p) =>
    [
      p.ticker,
      classToLabel(p.assetClass),
      p.currency,
      p.quantity.toString().replace(".", ","),
      p.avgPrice.toFixed(2).replace(".", ","),
      p.expectedYield.toFixed(4).replace(".", ","),
      p.capitalGain.toFixed(4).replace(".", ","),
    ].join(";"),
  );
  return BOM + [HEADER, ...lines].join("\r\n") + "\r\n";
}

export async function importCsv(file: File): Promise<ImportResult> {
  const text = await file.text();
  const positions: AssetPosition[] = [];
  const errors: ImportError[] = [];

  if (text.trim() === "") return { positions, errors };

  const stripped = text.replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(stripped, { delimiter: ";", skipEmptyLines: true });

  if (parsed.data.length === 0) return { positions, errors };

  const header = parsed.data[0];
  const expected = HEADER.split(";");
  if (header.length !== expected.length || header.some((h, i) => h.trim() !== expected[i])) {
    errors.push({ row: 1, message: `Cabeçalho inválido. Esperado: ${HEADER}` });
    return { positions, errors };
  }

  for (let i = 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (row.length < 7) {
      errors.push({ row: i + 1, message: "linha incompleta" });
      continue;
    }
    const [ticker, classeLabel, currency, qty, price, yld, capGain] = row;
    const assetClass = LABEL_TO_CLASS[classeLabel.trim()];
    if (!assetClass) {
      errors.push({ row: i + 1, field: "Classe", message: `classe desconhecida: ${classeLabel}` });
      continue;
    }
    const quantity = parseBRNumber(qty);
    const avgPrice = parseBRNumber(price);
    const expectedYield = parseBRNumber(yld);
    const capitalGain = parseBRNumber(capGain);
    if (quantity === null || avgPrice === null || expectedYield === null || capitalGain === null) {
      errors.push({ row: i + 1, message: "valor numérico inválido" });
      continue;
    }
    const candidate = {
      id: crypto.randomUUID(),
      ticker: ticker.trim(),
      assetClass,
      currency: (currency.trim() as Currency),
      quantity,
      avgPrice,
      expectedYield,
      capitalGain,
      color: ASSET_CLASS_META[assetClass].color,
    };
    const result = assetPositionSchema.safeParse(candidate);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        errors.push({ row: i + 1, field: issue.path.join("."), message: issue.message });
      });
      continue;
    }
    positions.push(result.data);
  }

  return { positions, errors };
}
