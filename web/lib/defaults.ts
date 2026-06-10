import type { SimulateInput, MonteCarloInput, FinancingInput } from "./api-types";

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
      { name: "FIIs", weight: 0.50, expectedYield: 0.110, capitalGain: 0.01, taxRate: 0.00, note: "Papel + Tijolo + Agro + FoF + Híbrido", volatility: 0.15 },
      { name: "Ações BR Dividendos", weight: 0.20, expectedYield: 0.090, capitalGain: 0.03, taxRate: 0.00, note: "", volatility: 0.27 },
      { name: "Dividend Aristocrats US", weight: 0.15, expectedYield: 0.040, capitalGain: 0.06, taxRate: 0.30, note: "", volatility: 0.18 },
      { name: "Tesouro IPCA+ / LCI", weight: 0.15, expectedYield: 0.115, capitalGain: 0.00, taxRate: 0.10, note: "", volatility: 0.05 },
    ],
  },
  benchmark: {
    kind: "cdi" as const,
    annualRate: 0.1475,  // prefilled live from /api/macro in the drawer
    ipcaSpread: 0,
    taxRate: 0.175,
  },
};

// 2000 trajectories balances precision and Render free-tier compute budget.
// 10000+ tends to time out (~30s) and return 500 on free tier. Users can bump
// up via the drawer if they upgrade to a paid Render plan.
export const DEFAULT_MC: MonteCarloInput = {
  nTrajectories: 2_000,
  seed: null,
  targetPatrimony: 0,
};

export const DEFAULT_GOAL = 600_000;

export const DEFAULT_FINANCING: FinancingInput = {
  termYears: 30,
  annualRate: 0.115,
  entryPct: 0.20,
  system: "SAC",
  monthlyInsuranceRate: 0.0005,
};
