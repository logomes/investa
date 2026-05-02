import type { FixedIncomePosition, IndexerKind } from "./fi-schema";
import type { MacroOut } from "./api-types";

const HOLDING_BRACKETS = [
  { maxDays: 180, rate: 0.225, label: "Até 180 dias" },
  { maxDays: 360, rate: 0.20, label: "181 a 360 dias" },
  { maxDays: 730, rate: 0.175, label: "361 a 720 dias" },
  { maxDays: Infinity, rate: 0.15, label: "Acima de 720 dias" },
];

export function effectiveAnnualRate(p: FixedIncomePosition, macro: MacroOut): number {
  switch (p.indexer) {
    case "prefixado":
      return p.rate;
    case "cdi":
      return macro.cdi * p.rate;
    case "selic":
      return macro.selic + p.rate;
    case "ipca":
      return (1 + macro.ipca) * (1 + p.rate) - 1;
  }
}

export function holdingDays(p: FixedIncomePosition, today: Date): number {
  const purchase = new Date(p.purchaseDate);
  const ms = today.getTime() - purchase.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function applicableIrRate(p: FixedIncomePosition, today: Date): number {
  if (p.isTaxExempt) return 0;
  const days = holdingDays(p, today);
  return HOLDING_BRACKETS.find((b) => days <= b.maxDays)!.rate;
}

export function totalAllocated(positions: FixedIncomePosition[]): number {
  return positions.reduce((sum, p) => sum + p.initialAmount, 0);
}

export function weightedYield(
  positions: FixedIncomePosition[],
  macro: MacroOut,
  today: Date = new Date(),
): number {
  const total = totalAllocated(positions);
  if (total === 0) return 0;
  const weighted = positions.reduce((sum, p) => {
    const grossYield = effectiveAnnualRate(p, macro);
    const ir = applicableIrRate(p, today);
    return sum + p.initialAmount * grossYield * (1 - ir);
  }, 0);
  return weighted / total;
}

export function weightedDuration(
  positions: FixedIncomePosition[],
  today: Date,
): number {
  const total = totalAllocated(positions);
  if (total === 0) return 0;
  const weighted = positions.reduce((sum, p) => {
    if (!p.maturityDate) return sum;
    const yearsToMaturity =
      (new Date(p.maturityDate).getTime() - today.getTime()) / (365 * 86_400_000);
    return sum + p.initialAmount * Math.max(0, yearsToMaturity);
  }, 0);
  return weighted / total;
}

export function effectiveIrRate(positions: FixedIncomePosition[], today: Date): number {
  const total = totalAllocated(positions);
  if (total === 0) return 0;
  const weighted = positions.reduce(
    (sum, p) => sum + p.initialAmount * applicableIrRate(p, today),
    0,
  );
  return weighted / total;
}

export type ByIndexerRow = { indexer: IndexerKind; total: number; pct: number };

export function byIndexer(positions: FixedIncomePosition[]): ByIndexerRow[] {
  const total = totalAllocated(positions);
  const groups: Record<string, number> = {};
  for (const p of positions) {
    groups[p.indexer] = (groups[p.indexer] ?? 0) + p.initialAmount;
  }
  return Object.entries(groups)
    .map(([indexer, sum]) => ({
      indexer: indexer as IndexerKind,
      total: sum,
      pct: total > 0 ? sum / total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export type ByIrBucketRow = { label: string; rate: number; total: number };

export function byIrBracket(
  positions: FixedIncomePosition[],
  today: Date,
): ByIrBucketRow[] {
  const result: ByIrBucketRow[] = HOLDING_BRACKETS.map((b) => ({
    label: b.label,
    rate: b.rate,
    total: 0,
  }));
  result.push({ label: "Isento (LCI/LCA/etc)", rate: 0, total: 0 });
  for (const p of positions) {
    if (p.isTaxExempt) {
      result[result.length - 1].total += p.initialAmount;
    } else {
      const days = holdingDays(p, today);
      const idx = HOLDING_BRACKETS.findIndex((b) => days <= b.maxDays);
      result[idx].total += p.initialAmount;
    }
  }
  return result;
}

export type CalendarYearRow = {
  year: number;  // 0 sentinel = "sem vencimento"
  items: FixedIncomePosition[];
  totalAtMaturity: number;
};

export function calendarByYear(positions: FixedIncomePosition[]): CalendarYearRow[] {
  const groups: Record<number, FixedIncomePosition[]> = {};
  const noMaturity: FixedIncomePosition[] = [];
  for (const p of positions) {
    if (!p.maturityDate) {
      noMaturity.push(p);
    } else {
      const year = new Date(p.maturityDate).getUTCFullYear();
      (groups[year] ??= []).push(p);
    }
  }
  const result: CalendarYearRow[] = Object.entries(groups)
    .map(([year, items]) => ({
      year: Number(year),
      items,
      totalAtMaturity: items.reduce((sum, p) => sum + p.initialAmount, 0),
    }))
    .sort((a, b) => a.year - b.year);
  if (noMaturity.length) {
    result.push({
      year: 0,
      items: noMaturity,
      totalAtMaturity: noMaturity.reduce((sum, p) => sum + p.initialAmount, 0),
    });
  }
  return result;
}
