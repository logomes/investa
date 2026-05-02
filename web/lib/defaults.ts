import type { SimulateInput, MonteCarloInput } from "./api-types";

export const DEFAULT_SCENARIO: SimulateInput = {
  capital: 230_000,
  horizon: 10,
  reinvest: true,
  realEstate: {
    propertyValue: 230_000,
    monthlyRent: 1_500,
    annualAppreciation: 0.055,
    iptuRate: 0.010,
    vacancyMonthsPerYear: 1.0,
    managementFeePct: 0.10,
    maintenanceAnnual: 900,
    insuranceAnnual: 600,
    incomeTaxBracket: 0.075,
    acquisitionCostPct: 0.05,
    appreciationVolatility: 0.10,
    financing: null,
  },
  portfolio: {
    capital: 230_000,
    monthlyContribution: 0,
    contributionInflationIndexed: true,
    assets: [
      { name: "FIIs de Papel", weight: 0.25, expectedYield: 0.130, capitalGain: 0.00, taxRate: 0.00, note: "", volatility: 0.14 },
      { name: "FIIs de Tijolo", weight: 0.25, expectedYield: 0.090, capitalGain: 0.02, taxRate: 0.00, note: "", volatility: 0.16 },
      { name: "Ações BR Dividendos", weight: 0.20, expectedYield: 0.090, capitalGain: 0.03, taxRate: 0.00, note: "", volatility: 0.27 },
      { name: "Dividend Aristocrats US", weight: 0.15, expectedYield: 0.040, capitalGain: 0.06, taxRate: 0.30, note: "", volatility: 0.18 },
      { name: "Tesouro IPCA+ / LCI", weight: 0.15, expectedYield: 0.115, capitalGain: 0.00, taxRate: 0.10, note: "", volatility: 0.05 },
    ],
  },
  benchmark: {
    selicRate: 0.1475,
    taxRate: 0.175,
  },
};

export const DEFAULT_MC: MonteCarloInput = {
  nTrajectories: 10_000,
  seed: null,
  targetPatrimony: 0,
};

export const DEFAULT_GOAL = 600_000;
