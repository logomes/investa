import type { TaxComparisonRowOut } from "./api-types";

const PORTFOLIO_SCENARIO = "Carteira Diversificada";

export function splitTaxRows(rows: TaxComparisonRowOut[]): {
  portfolio: TaxComparisonRowOut | null;
  benchmark: TaxComparisonRowOut | null;
} {
  // API contract: exactly 2 rows — portfolio + one benchmark.
  return {
    portfolio: rows.find((r) => r.scenario === PORTFOLIO_SCENARIO) ?? null,
    benchmark: rows.find((r) => r.scenario !== PORTFOLIO_SCENARIO) ?? null,
  };
}

export type TaxDelta = {
  taxDiffAbs:        number;  // portfolio − benchmark
  burdenDiffPp:      number;
  portfolioPaysMore: boolean;
};

export function taxDelta(
  pf: TaxComparisonRowOut,
  bench: TaxComparisonRowOut,
): TaxDelta {
  const taxDiffAbs   = pf.annualTax - bench.annualTax;
  const burdenDiffPp = pf.effectiveTaxBurden - bench.effectiveTaxBurden;
  return {
    taxDiffAbs,
    burdenDiffPp,
    portfolioPaysMore: taxDiffAbs > 0,
  };
}

export const SCENARIO_COLORS = {
  benchmark: "#5CC8FF",
  portfolio: "#46E8A4",
  tax:       "#FF5D72",
} as const;

export const TAX_NOTES: Array<{ title: string; body: string }> = [
  {
    title: "FIIs",
    body: "Rendimentos mensais permanecem isentos para PF (ganho de capital na venda 20%).",
  },
  {
    title: "Ações BR — dividendos",
    body: "Isentos até R$ 50k/mês ou R$ 600k/ano por empresa.",
  },
  {
    title: "Ações US — dividendos",
    body: "30% retidos na fonte; tratado de bitributação pode reduzir.",
  },
  {
    title: "Tesouro Direto",
    body: "Tabela regressiva sobre rendimentos: 22,5% (≤180d) → 15% (>720d).",
  },
];
