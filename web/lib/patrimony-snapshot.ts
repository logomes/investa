import type { AssetPosition } from "./ativos-schema";
import type { FixedIncomePosition } from "./fi-schema";
import type { MacroOut } from "./api-types";
import { totalCurrentValue } from "./fi-derive";

export type PatrimonySnapshot = {
  date: string;           // ISO YYYY-MM-DD
  totalBRL: number;       // soma de RV + RF (marked-to-market)
  rendaVariavel: number;  // positions × (currentPrice ?? avgPrice) × FX
  rendaFixa: number;      // soma de rfCurrentValue (compound)
  positionsCount: number;
  rfCount: number;
  notes?: string;
};

/**
 * Marked-to-market value of an asset position. Uses currentPrice when
 * available (last imported quote), falls back to avgPrice otherwise.
 * USD assets are converted to BRL via macro.usdBrl.
 */
export function assetMarketValueBRL(p: AssetPosition, macro: MacroOut): number {
  const price = p.currentPrice ?? p.avgPrice;
  const nativeValue = p.quantity * price;
  return p.currency === "USD" ? nativeValue * macro.usdBrl : nativeValue;
}

export function computeSnapshot(
  positions: readonly AssetPosition[],
  fiPositions: readonly FixedIncomePosition[],
  macro: MacroOut,
  date: Date = new Date(),
  notes?: string,
): PatrimonySnapshot {
  const rendaVariavel = positions.reduce((sum, p) => sum + assetMarketValueBRL(p, macro), 0);
  const rendaFixa = totalCurrentValue(fiPositions as FixedIncomePosition[], macro, date);
  return {
    date: date.toISOString().slice(0, 10),
    totalBRL: rendaVariavel + rendaFixa,
    rendaVariavel,
    rendaFixa,
    positionsCount: positions.length,
    rfCount: fiPositions.length,
    notes,
  };
}

export type PatrimonyRange = "12m" | "24m" | "5a" | "10a" | "all";

export const PATRIMONY_RANGES: readonly PatrimonyRange[] = ["12m", "24m", "5a", "10a", "all"];

export const PATRIMONY_RANGE_LABEL: Record<PatrimonyRange, string> = {
  "12m": "12m",
  "24m": "24m",
  "5a": "5a",
  "10a": "10a",
  "all": "Tudo",
};

/**
 * Filter snapshots to a trailing time window relative to `now`. Pure: returns
 * a new array, doesn't mutate input. Cutoff is inclusive (snapshots with date
 * equal to the cutoff ISO are kept). `range = "all"` returns the input as-is.
 */
export function filterSnapshotsByRange(
  snapshots: readonly PatrimonySnapshot[],
  range: PatrimonyRange,
  now: Date = new Date(),
): PatrimonySnapshot[] {
  if (range === "all") return [...snapshots];
  const cutoff = new Date(now);
  switch (range) {
    case "12m": cutoff.setMonth(cutoff.getMonth() - 12); break;
    case "24m": cutoff.setMonth(cutoff.getMonth() - 24); break;
    case "5a":  cutoff.setFullYear(cutoff.getFullYear() - 5);  break;
    case "10a": cutoff.setFullYear(cutoff.getFullYear() - 10); break;
  }
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.date >= cutoffIso);
}
