/**
 * Pure recommender for the GoalCard. Closed-form FV math; no React, no I/O.
 *
 * Strategy:
 *   1. If capital already clears the goal → already-met (nothing to recommend).
 *   2. If the simulate engine's projectedFinal already clears the goal → already-on-track.
 *   3. Otherwise compute the additional monthly contribution that closes the gap
 *      using an ordinary annuity FV formula. If the result requires a 10x jump in
 *      the user's current contribution (or > R$ 50k absolute when current=0),
 *      flag as unreachable.
 *
 * The "rate" fed into FV is the portfolio's blended total return (yield net of
 * tax + capital gain). When the user opts to index contributions to IPCA, we
 * use the real rate (nominal discounted by expected inflation) so the math is
 * consistent with the backend simulate engine.
 */

export type RecommendInputs = {
  goal: number;
  capital: number;
  horizonYears: number;
  currentMonthlyContribution: number;
  contributionInflationIndexed: boolean;
  totalReturnAnnualNet: number;
  projectedFinalPatrimony: number;
  expectedInflation: number;
};

export type Recommendation =
  | { state: "already-met" }
  | { state: "already-on-track"; projectedFinal: number }
  | { state: "below"; suggestedMonthly: number; deltaMonthly: number }
  | { state: "unreachable"; suggestedMonthly: number };

const UNREACHABLE_MULTIPLIER = 10;
const UNREACHABLE_ABSOLUTE_CAP_BRL = 50_000;

export function recommend(i: RecommendInputs): Recommendation {
  if (i.capital >= i.goal) return { state: "already-met" };
  if (i.projectedFinalPatrimony >= i.goal) {
    return { state: "already-on-track", projectedFinal: i.projectedFinalPatrimony };
  }

  // gap > 0 here — guaranteed by the `projectedFinalPatrimony >= goal` check above.
  const gap = i.goal - i.projectedFinalPatrimony;
  const monthlyPeriods = i.horizonYears * 12;

  if (monthlyPeriods === 0) {
    return { state: "unreachable", suggestedMonthly: i.currentMonthlyContribution };
  }

  const annualRate = i.contributionInflationIndexed
    ? (1 + i.totalReturnAnnualNet) / (1 + i.expectedInflation) - 1
    : i.totalReturnAnnualNet;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

  // indexed stream's nominal FV = real-rate annuity FV × (1+ipca)^h —
  // without this the suggestion overestimates by that factor
  const nominalizer = i.contributionInflationIndexed
    ? Math.pow(1 + i.expectedInflation, i.horizonYears)
    : 1;
  const additionalMonthly =
    (Math.abs(monthlyRate) < 1e-9
      ? gap / monthlyPeriods
      : (gap * monthlyRate) / (Math.pow(1 + monthlyRate, monthlyPeriods) - 1)) / nominalizer;

  const suggested = i.currentMonthlyContribution + additionalMonthly;

  const cap = Math.max(
    i.currentMonthlyContribution * UNREACHABLE_MULTIPLIER,
    UNREACHABLE_ABSOLUTE_CAP_BRL,
  );
  if (suggested > cap) {
    return { state: "unreachable", suggestedMonthly: suggested };
  }

  return { state: "below", suggestedMonthly: suggested, deltaMonthly: additionalMonthly };
}

export function goalProbability(finalDistribution: readonly number[], goal: number): number {
  if (finalDistribution.length === 0) return 0;
  let hit = 0;
  for (const v of finalDistribution) if (v >= goal) hit++;
  return hit / finalDistribution.length;
}
