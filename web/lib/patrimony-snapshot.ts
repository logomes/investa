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
