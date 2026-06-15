import type { SimulateInput, SimulateOut } from "./api-types";

export type TaxKpis = {
  totalTax: number; // path + exit at horizon
  effectiveRate: number; // totalTax / gross gain (0 if gain <= 0)
  latentExitTax: number; // exit tax at horizon
  exemptionValue: number; // net final − allTaxedFinal ("o que suas isenções valem")
};

// Total nominal amount the user put in by the horizon (cost basis for effectiveRate).
// Begin-of-year contributions; indexed grows by ipca.
export function totalContributed(scenario: SimulateInput): number {
  const { capital, horizon, expectedInflation } = scenario;
  const { monthlyContribution, contributionInflationIndexed } = scenario.portfolio;
  if (monthlyContribution <= 0) return capital;
  const annual = 12 * monthlyContribution;
  let sum = 0;
  for (let t = 0; t < horizon; t++) {
    sum += annual * (contributionInflationIndexed ? Math.pow(1 + expectedInflation, t) : 1);
  }
  return capital + sum;
}

export function taxKpis(sim: SimulateOut, contributedTotal: number): TaxKpis {
  const tp = sim.taxProjection;
  const last = tp.taxPaidByYear.length - 1;
  const totalTax = tp.taxPaidByYear[last] + tp.exitTaxByYear[last];
  const grossFinal = sim.portfolio.grossPatrimony[sim.portfolio.grossPatrimony.length - 1];
  const gain = grossFinal - contributedTotal;
  const netFinal = sim.portfolio.patrimony[sim.portfolio.patrimony.length - 1];
  return {
    totalTax,
    effectiveRate: gain > 0 ? totalTax / gain : 0,
    latentExitTax: tp.exitTaxByYear[last],
    exemptionValue: netFinal - tp.allTaxedFinal,
  };
}

export const TAX_PROFILE_LABEL: Record<string, string> = {
  isento: "Isento",
  fii: "FII",
  acoes_br: "Ações BR",
  rf_regressiva: "RF regressiva",
  come_cotas: "Come-cotas",
  dividendos_exterior: "Div. exterior",
  tributado_anual: "Tributado anual",
};

export const SCENARIO_COLORS = {
  benchmark: "#5CC8FF",
  portfolio: "#46E8A4",
  tax: "#FF5D72",
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
  {
    title: "Come-cotas",
    body: "Fundos pagam come-cotas: 15% sobre o ganho a cada semestre, antecipando o IR.",
  },
];
