// Regressive IR bracket at annual resolution. Mirrors the engine's
// `regressive_rate` (api): 17.5% for the first ~year, falling to 15% for
// holding periods >= 2 years. Kept here so the LCI vs CDB comparator stays
// in sync with how the backend taxes RF regressiva over the horizon.
const rate = (h: number) => (h >= 2 ? 0.15 : 0.175);

/** CDB gross rate that nets the same as an LCI at `lciRate` over `horizonYears`. */
export function equivalentCdbRate(lciRate: number, horizonYears: number): number {
  const target = Math.pow(1 + lciRate, horizonYears);
  const gross = 1 + (target - 1) / (1 - rate(horizonYears));
  return Math.pow(gross, 1 / horizonYears) - 1;
}
