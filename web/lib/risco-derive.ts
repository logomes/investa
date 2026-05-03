import type { MonteCarloResultOut } from "./api-types";

export const LOSS_RATE_WARNING = 0.05;

// ---------- Per-scenario stats ----------

export type RiskStats = {
  finalP10: number;
  finalP50: number;
  finalP90: number;
  meanMaxDrawdown: number;
  probTarget: number | null;
  lossRate: number;
};

export function riskStats(args: {
  result: MonteCarloResultOut;
  target: number;
  capitalInitial: number;
}): RiskStats {
  const { result, target, capitalInitial } = args;
  const final = result.finalDistribution;
  const probTarget = target > 0
    ? final.filter((v) => v >= target).length / final.length
    : null;
  const lossRate = final.filter((v) => v < capitalInitial).length / final.length;
  const meanDrawdown = result.maxDrawdowns.reduce((s, v) => s + v, 0) / result.maxDrawdowns.length;
  return {
    finalP10: result.p10[result.p10.length - 1],
    finalP50: result.p50[result.p50.length - 1],
    finalP90: result.p90[result.p90.length - 1],
    meanMaxDrawdown: meanDrawdown,
    probTarget,
    lossRate,
  };
}

// ---------- Histogram binning ----------

export type HistogramBin = { start: number; end: number; count: number };

export function binDistribution(values: number[], numBins: number = 30): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ start: min, end: max, count: values.length }];
  const width = (max - min) / numBins;
  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = v >= max ? numBins - 1 : Math.floor((v - min) / width);
    bins[idx].count++;
  }
  return bins;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function distributionPercentiles(values: number[]): {
  p10: number;
  p50: number;
  p90: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.10),
    p50: quantile(sorted, 0.50),
    p90: quantile(sorted, 0.90),
  };
}

// ---------- Loss rate banner ----------

export type LossRateInfo = {
  show: boolean;
  realEstateRate: number;
  portfolioRate: number;
  flagged: Array<{ label: string; rate: number }>;
};

export function lossRateInfo(args: {
  realEstateRate: number;
  portfolioRate: number;
  threshold?: number;
}): LossRateInfo {
  const threshold = args.threshold ?? LOSS_RATE_WARNING;
  const flagged: Array<{ label: string; rate: number }> = [];
  if (args.realEstateRate > threshold) flagged.push({ label: "Imóvel", rate: args.realEstateRate });
  if (args.portfolioRate > threshold) flagged.push({ label: "Carteira", rate: args.portfolioRate });
  return {
    show: flagged.length > 0,
    realEstateRate: args.realEstateRate,
    portfolioRate: args.portfolioRate,
    flagged,
  };
}
