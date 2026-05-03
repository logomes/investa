import type { TaxComparisonRowOut } from "./api-types";

function isRealEstate(scenario: string): boolean {
  return scenario.toLowerCase().startsWith("imóvel");
}

function isPortfolio(scenario: string): boolean {
  return scenario === "Carteira Diversificada";
}

export function splitTaxRows(rows: TaxComparisonRowOut[]): {
  realEstate: TaxComparisonRowOut | null;
  portfolio:  TaxComparisonRowOut | null;
} {
  return {
    realEstate: rows.find((r) => isRealEstate(r.scenario)) ?? null,
    portfolio:  rows.find((r) => isPortfolio(r.scenario))  ?? null,
  };
}

export type TaxDelta = {
  taxDiffAbs:         number;
  burdenDiffPp:       number;
  realEstatePaysMore: boolean;
};

export function taxDelta(
  re: TaxComparisonRowOut,
  pf: TaxComparisonRowOut,
): TaxDelta {
  const taxDiffAbs   = re.annualTax - pf.annualTax;
  const burdenDiffPp = re.effectiveTaxBurden - pf.effectiveTaxBurden;
  return {
    taxDiffAbs,
    burdenDiffPp,
    realEstatePaysMore: taxDiffAbs > 0,
  };
}

export const SCENARIO_COLORS = {
  realEstate: "#FF6B5B",
  portfolio:  "#46E8A4",
  tax:        "#FF5D72",
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
    title: "Aluguel (PF)",
    body: "Tabela progressiva via carnê-leão (0% a 27,5% conforme renda).",
  },
  {
    title: "Tesouro Direto",
    body: "Tabela regressiva sobre rendimentos: 22,5% (≤180d) → 15% (>720d).",
  },
];
