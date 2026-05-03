import type { PortfolioInput, RealEstateInput, MacroOut } from "./api-types";
import { grossYield as imovelGrossYield, netYield as imovelNetYield } from "./imovel-derive";

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

export function yieldComparison(args: {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;
  macro: MacroOut;
}): YieldRow[] {
  const { pf, re, benchmarkTaxRate, macro } = args;
  return [
    { label: "Carteira blended",      value: blendedYield(pf),                     color: "#46E8A4" },
    { label: "Imóvel bruto",          value: imovelGrossYield(re),                 color: "#FFC857" },
    { label: "Imóvel líquido",        value: imovelNetYield(re),                   color: "#FF6B5B" },
    { label: "Tesouro Selic líquido", value: macro.selic * (1 - benchmarkTaxRate), color: "#5CC8FF" },
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
