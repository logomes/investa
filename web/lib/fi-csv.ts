import Papa from "papaparse";
import { positionSchema, type FixedIncomePosition } from "./fi-schema";

const COLUMNS = [
  "name",
  "initialAmount",
  "purchaseDate",
  "indexer",
  "rate",
  "maturityDate",
  "isTaxExempt",
] as const;

const PALETTE = [
  "#3498DB", "#E67E22", "#9B59B6", "#1ABC9C",
  "#E74C3C", "#16A085", "#F39C12", "#34495E",
];

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    return ["true", "1", "yes"].includes(v.toLowerCase().trim());
  }
  return false;
}

export function exportCsv(positions: FixedIncomePosition[]): string {
  const rows = positions.map((p) => ({
    name: p.name,
    initialAmount: p.initialAmount,
    purchaseDate: p.purchaseDate,
    indexer: p.indexer,
    rate: p.rate,
    maturityDate: p.maturityDate ?? "",
    isTaxExempt: p.isTaxExempt,
  }));
  return Papa.unparse(rows, { columns: [...COLUMNS] });
}

export type ImportResult = {
  positions: FixedIncomePosition[];
  errors: Array<{ row: number; message: string }>;
};

export function importCsv(csvText: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const positions: FixedIncomePosition[] = [];
  const errors: ImportResult["errors"] = [];
  parsed.data.forEach((row, idx) => {
    const candidate = {
      id: crypto.randomUUID(),
      name: String(row.name ?? "").trim(),
      initialAmount: Number(row.initialAmount),
      purchaseDate: String(row.purchaseDate ?? "").trim(),
      indexer: String(row.indexer ?? "").trim(),
      rate: Number(row.rate),
      maturityDate:
        row.maturityDate && String(row.maturityDate).trim() !== ""
          ? String(row.maturityDate).trim()
          : null,
      isTaxExempt: coerceBool(row.isTaxExempt),
      color: PALETTE[idx % PALETTE.length],
    };
    const result = positionSchema.safeParse(candidate);
    if (result.success) {
      positions.push(result.data);
    } else {
      errors.push({
        row: idx + 2, // +1 for header, +1 for 1-indexed
        message: result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }
  });
  return { positions, errors };
}
