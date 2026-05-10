/**
 * Suggests how to distribute a monthly contribution across the asset classes
 * the user already holds, with the goal of moving the portfolio toward a
 * target allocation.
 *
 * v1 strategies:
 *   - "balanced": target = 1/N for each class with positions (where N is
 *     the number of distinct classes). Pull-toward-equal-weight.
 *   - "preserve": target = current weights (DCA mode — no drift).
 *
 * The output describes only *how much* to put in each class. Picking the
 * specific ticker inside the class is left to the user.
 */
import { ASSET_CLASS_META, type AssetClass, type AssetPosition } from "./ativos-schema";
import { positionValueBRL } from "./ativos-derive";
import type { MacroOut } from "./api-types";

export type ContributionStrategy = "balanced" | "preserve";

export type ClassSuggestion = {
  assetClass: AssetClass;
  label: string;
  color: string;
  currentValueBRL: number;
  currentPct: number;     // 0-1
  targetPct: number;      // 0-1
  gapPct: number;         // targetPct - currentPct (positive = underweight)
  suggestedR$: number;    // amount of the contribution to allocate here
};

export type ContributionPlan = {
  totalAporte: number;
  totalCurrentBRL: number;
  totalProjectedBRL: number; // current + aporte
  byClass: ClassSuggestion[];
};

/**
 * Build the contribution plan.
 *
 * The "deficit pull" approach: for each class, compute the BRL gap between
 * its target value (after aporte) and current value. Distribute the aporte
 * proportionally to positive gaps (underweighted classes get the share).
 * If no class is underweighted (already balanced), distribute proportionally
 * to current weight (preserve-mode fallback).
 */
export function planContribution(
  positions: readonly AssetPosition[],
  macro: MacroOut,
  aporte: number,
  strategy: ContributionStrategy = "balanced",
): ContributionPlan {
  const safeAporte = Math.max(0, aporte);
  const valuesBRL = positions.map((p) => positionValueBRL(p, macro));
  const totalCurrent = valuesBRL.reduce((s, v) => s + v, 0);

  // Aggregate by class
  const grouped = new Map<AssetClass, number>();
  positions.forEach((p, i) => {
    grouped.set(p.assetClass, (grouped.get(p.assetClass) ?? 0) + valuesBRL[i]);
  });

  if (grouped.size === 0) {
    return { totalAporte: safeAporte, totalCurrentBRL: 0, totalProjectedBRL: safeAporte, byClass: [] };
  }

  const projected = totalCurrent + safeAporte;

  const targets = new Map<AssetClass, number>();
  if (strategy === "balanced") {
    const equal = 1 / grouped.size;
    for (const cls of Array.from(grouped.keys())) targets.set(cls, equal);
  } else {
    // preserve: target = current weight
    for (const [cls, value] of Array.from(grouped.entries())) {
      targets.set(cls, totalCurrent > 0 ? value / totalCurrent : 0);
    }
  }

  // Per class, deficit = target_value (after aporte) - current_value
  const deficits = new Map<AssetClass, number>();
  let totalPositiveDeficit = 0;
  for (const [cls, currentValue] of Array.from(grouped.entries())) {
    const target = targets.get(cls) ?? 0;
    const targetValue = projected * target;
    const deficit = targetValue - currentValue;
    deficits.set(cls, deficit);
    if (deficit > 0) totalPositiveDeficit += deficit;
  }

  // Distribute aporte proportionally to positive deficits.
  // If no positive deficits (already at or above target), fall back to
  // distributing proportionally to current weight.
  const suggestions = new Map<AssetClass, number>();
  if (totalPositiveDeficit > 0 && safeAporte > 0) {
    for (const [cls, deficit] of Array.from(deficits.entries())) {
      const share = deficit > 0 ? (deficit / totalPositiveDeficit) * safeAporte : 0;
      suggestions.set(cls, Math.min(share, deficit)); // don't overshoot the target
    }
    // Any leftover (when target was reached for all positive deficits)
    let allocated = 0;
    suggestions.forEach((v) => { allocated += v; });
    const leftover = safeAporte - allocated;
    if (leftover > 0.01) {
      // Distribute leftover by current weight
      for (const [cls, currentValue] of Array.from(grouped.entries())) {
        const w = totalCurrent > 0 ? currentValue / totalCurrent : 1 / grouped.size;
        suggestions.set(cls, (suggestions.get(cls) ?? 0) + leftover * w);
      }
    }
  } else {
    for (const [cls, currentValue] of Array.from(grouped.entries())) {
      const w = totalCurrent > 0 ? currentValue / totalCurrent : 1 / grouped.size;
      suggestions.set(cls, safeAporte * w);
    }
  }

  const byClass: ClassSuggestion[] = Array.from(grouped.entries())
    .map(([cls, currentValue]) => {
      const target = targets.get(cls) ?? 0;
      const currentPct = totalCurrent > 0 ? currentValue / totalCurrent : 0;
      const meta = ASSET_CLASS_META[cls];
      return {
        assetClass: cls,
        label: meta.label,
        color: meta.color,
        currentValueBRL: currentValue,
        currentPct,
        targetPct: target,
        gapPct: target - currentPct,
        suggestedR$: suggestions.get(cls) ?? 0,
      };
    })
    .sort((a, b) => b.suggestedR$ - a.suggestedR$);

  return {
    totalAporte: safeAporte,
    totalCurrentBRL: totalCurrent,
    totalProjectedBRL: projected,
    byClass,
  };
}
