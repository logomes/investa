import type { PortfolioInput, BenchmarkInput, MacroOut } from "./api-types";

// ---------- KPIs blended ----------

export function blendedYield(pf: PortfolioInput): number {
  return pf.assets.reduce(
    (sum, a) => sum + a.weight * a.expectedYield * (1 - a.taxRate),
    0,
  );
}

export function blendedCapitalGain(pf: PortfolioInput): number {
  return pf.assets.reduce((sum, a) => sum + a.weight * a.capitalGain, 0);
}

export function totalReturn(pf: PortfolioInput): number {
  return blendedYield(pf) + blendedCapitalGain(pf);
}

export function annualIncome(pf: PortfolioInput): number {
  return pf.capital * blendedYield(pf);
}

// ---------- Pesos ----------

export function normalizedWeights(pf: PortfolioInput): number[] {
  const sum = pf.assets.reduce((s, a) => s + a.weight, 0);
  if (sum <= 0) return pf.assets.map(() => 0);
  return pf.assets.map((a) => a.weight / sum);
}

// ---------- Allocation segments ----------

export type AllocationSegment = {
  name: string;
  weight: number;
  amount: number;
  expectedYield: number;
  taxRate: number;
  netYield: number;
  color: string;
};

export function allocationSegments(pf: PortfolioInput): AllocationSegment[] {
  const weights = normalizedWeights(pf);
  return pf.assets.map((a, i) => ({
    name: a.name,
    weight: weights[i],
    amount: pf.capital * weights[i],
    expectedYield: a.expectedYield,
    taxRate: a.taxRate,
    netYield: a.expectedYield * (1 - a.taxRate),
    color: ASSET_COLORS[i % ASSET_COLORS.length],
  }));
}

// ---------- Yield comparison ----------

export type YieldRow = { label: string; value: number; color: string };

/** Effective NET annual rate of a deferred-RF lump sum held for `horizonYears` years. */
export function benchmarkNetYield(b: BenchmarkInput, horizonYears: number): number {
  const rate = horizonYears >= 2 ? 0.15 : 0.175;
  const gross = Math.pow(1 + b.annualRate, horizonYears);
  const net = 1 + (gross - 1) * (1 - rate);
  return Math.pow(net, 1 / horizonYears) - 1;
}

export function benchmarkLabel(b: BenchmarkInput): string {
  if (b.kind === "cdi") return "CDI (líquido)";
  if (b.kind === "selic") return "Selic (líquido)";
  return `IPCA + ${(b.ipcaSpread * 100).toFixed(1).replace(".", ",")}% (líquido)`;
}

export function yieldComparison(args: {
  pf: PortfolioInput;
  benchmark: BenchmarkInput;
  horizonYears: number;
}): YieldRow[] {
  const { pf, benchmark, horizonYears } = args;
  return [
    { label: "Carteira blended",               value: blendedYield(pf),                          color: "#46E8A4" },
    { label: "Carteira total (yield + ganho)", value: totalReturn(pf),                           color: "#FFC857" },
    { label: benchmarkLabel(benchmark),        value: benchmarkNetYield(benchmark, horizonYears), color: "#5CC8FF" },
  ];
}

export type RefLine = { label: string; value: number };

export function yieldRefLines(macro: MacroOut): RefLine[] {
  return [
    { label: "Selic", value: macro.selic },
    { label: "IPCA",  value: macro.ipca },
  ];
}

// ---------- Paleta ----------

export const ASSET_COLORS: string[] = [
  "#FFC857",  // 0 — amber
  "#FF6B5B",  // 1 — coral
  "#5CC8FF",  // 2 — cyan
  "#46E8A4",  // 3 — green
  "#C39BD3",  // 4 — purple
  "#FFB088",  // 5 — fallback
  "#7DCFFF",  // 6 — fallback
  "#A2E5C0",  // 7 — fallback
];

// ---------- Donut geometry ----------

export type DonutSlice = {
  path: string;
  color: string;
  midAngle: number;
};

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export function donutSlices(args: {
  segments: AllocationSegment[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
}): DonutSlice[] {
  const { segments, cx, cy, outerR, innerR } = args;
  const visible = segments.filter((s) => s.weight > 0);
  const slices: DonutSlice[] = [];

  let cumulative = -HALF_PI;

  for (const seg of visible) {
    const sweep = seg.weight * TWO_PI;
    const start = cumulative;
    const end = cumulative + sweep;
    const mid = (start + end) / 2;

    let path: string;

    if (seg.weight >= 1 - 1e-9) {
      const top = polar(cx, cy, outerR, -HALF_PI);
      const bot = polar(cx, cy, outerR, HALF_PI);
      const topInner = polar(cx, cy, innerR, -HALF_PI);
      const botInner = polar(cx, cy, innerR, HALF_PI);
      path =
        `M ${top[0]} ${top[1]} ` +
        `A ${outerR} ${outerR} 0 1 1 ${bot[0]} ${bot[1]} ` +
        `A ${outerR} ${outerR} 0 1 1 ${top[0]} ${top[1]} ` +
        `L ${topInner[0]} ${topInner[1]} ` +
        `A ${innerR} ${innerR} 0 1 0 ${botInner[0]} ${botInner[1]} ` +
        `A ${innerR} ${innerR} 0 1 0 ${topInner[0]} ${topInner[1]} ` +
        `Z`;
    } else {
      const largeArc = sweep > Math.PI ? 1 : 0;
      const [x0o, y0o] = polar(cx, cy, outerR, start);
      const [x1o, y1o] = polar(cx, cy, outerR, end);
      const [x0i, y0i] = polar(cx, cy, innerR, end);
      const [x1i, y1i] = polar(cx, cy, innerR, start);
      path =
        `M ${x0o} ${y0o} ` +
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o} ` +
        `L ${x0i} ${y0i} ` +
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i} ` +
        `Z`;
    }

    slices.push({ path, color: seg.color, midAngle: mid });
    cumulative = end;
  }

  return slices;
}
