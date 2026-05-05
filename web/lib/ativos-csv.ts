import Papa from "papaparse";
import { assetPositionSchema, ASSET_CLASS_META } from "./ativos-schema";
import type { AssetPosition, AssetClass, Currency } from "./ativos-schema";

export type ImportError = { row: number; field?: string; message: string };
export type ImportResult = { positions: AssetPosition[]; errors: ImportError[] };

const HEADER = "Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital";

// Reverse map: human label → enum key
const LABEL_TO_CLASS: Record<string, AssetClass> = {
  "FII Papel":              "FII_PAPEL",
  "FII de Papel":           "FII_PAPEL",
  "FII Tijolo":             "FII_TIJOLO",
  "FII de Tijolo":          "FII_TIJOLO",
  "Ação BR Dividendo":      "ACAO_BR_DIVIDENDO",
  "Ação BR (dividendo)":    "ACAO_BR_DIVIDENDO",
  "Ação BR Crescimento":    "ACAO_BR_CRESCIMENTO",
  "Ação BR (crescimento)":  "ACAO_BR_CRESCIMENTO",
  "ETF BR":                 "ETF_BR",
  "BDR":                    "BDR",
  "Stock US":               "STOCK_US",
  "REIT US":                "REIT_US",
  "ETF US":                 "ETF_US",
};

function classToLabel(cls: AssetClass): string {
  return ASSET_CLASS_META[cls].label;
}

function parseBRNumber(s: string): number | null {
  const cleaned = s.replace(",", ".").trim();
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
    errors.push({ row: 0, message: `Cabeçalho inválido. Esperado: ${HEADER}` });
    return { positions, errors };
  }

  for (let i = 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (row.length < 7) {
      errors.push({ row: i, message: "linha incompleta" });
      continue;
    }
    const [ticker, classeLabel, currency, qty, price, yld, capGain] = row;
    const assetClass = LABEL_TO_CLASS[classeLabel.trim()];
    if (!assetClass) {
      errors.push({ row: i, field: "Classe", message: `classe desconhecida: ${classeLabel}` });
      continue;
    }
    const quantity = parseBRNumber(qty);
    const avgPrice = parseBRNumber(price);
    const expectedYield = parseBRNumber(yld);
    const capitalGain = parseBRNumber(capGain);
    if (quantity === null || avgPrice === null || expectedYield === null || capitalGain === null) {
      errors.push({ row: i, message: "valor numérico inválido" });
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
        errors.push({ row: i, field: issue.path.join("."), message: issue.message });
      });
      continue;
    }
    positions.push(result.data);
  }

  return { positions, errors };
}
