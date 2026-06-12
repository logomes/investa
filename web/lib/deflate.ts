/**
 * Deflation to "reais de hoje": divide nominal values by (1+ipca)^years.
 * Pure math — the display mode that decides WHEN to apply this lives in the
 * scenario store; components combine both via useDeflation().
 */

export function deflationFactor(ipca: number, years: number): number {
  return Math.pow(1 + ipca, -years);
}

export function deflateAt(value: number, ipca: number, years: number): number {
  return value * deflationFactor(ipca, years);
}

/** Index = year (series start at year 0, like SimulationResultOut arrays). */
export function deflateSeries(values: readonly number[], ipca: number): number[] {
  return values.map((v, year) => deflateAt(v, ipca, year));
}

/** Inverse of deflateAt: today's-money value → its nominal equivalent at year N. */
export function inflateToNominal(value: number, ipca: number, years: number): number {
  return value / deflationFactor(ipca, years);
}
