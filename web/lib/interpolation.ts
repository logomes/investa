/**
 * Geometric (compound) interpolation between consecutive yearly points,
 * producing N steps within each year. Falls back to linear when one of the
 * endpoints is non-positive (geometric requires Y_a > 0 and Y_b > 0).
 *
 * For yearly = [Y0, Y1] and stepsPerYear = 12, returns 13 points:
 * [M0, M1, ..., M12] where M0 === Y0, M12 === Y1.
 */
export function interpolateMonthly(yearly: number[], stepsPerYear = 12): number[] {
  if (yearly.length === 0) return [];
  if (yearly.length === 1) return [yearly[0]];

  const out: number[] = [yearly[0]];
  for (let y = 0; y < yearly.length - 1; y++) {
    const a = yearly[y];
    const b = yearly[y + 1];
    const useGeometric = a > 0 && b > 0;
    for (let s = 1; s <= stepsPerYear; s++) {
      const t = s / stepsPerYear;
      const v = useGeometric ? a * Math.pow(b / a, t) : a + (b - a) * t;
      out.push(v);
    }
  }
  return out;
}
