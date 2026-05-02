// Mirror of api/schemas/inputs.py and api/schemas/outputs.py.
// camelCase field names match the Pydantic alias_generator output.

export type FinancingInput = {
  termYears: number;
  annualRate: number;
  entryPct: number;
  system: "SAC" | "Price";
  monthlyInsuranceRate: number;
};

export type RealEstateInput = {
  propertyValue: number;
  monthlyRent: number;
  annualAppreciation: number;
  iptuRate: number;
  vacancyMonthsPerYear: number;
  managementFeePct: number;
  maintenanceAnnual: number;
  insuranceAnnual: number;
  incomeTaxBracket: number;
  acquisitionCostPct: number;
  appreciationVolatility: number;
  financing: FinancingInput | null;
};

export type PortfolioAssetInput = {
  name: string;
  weight: number;
  expectedYield: number;
  capitalGain: number;
  taxRate: number;
  note: string;
  volatility: number;
};

export type PortfolioInput = {
  capital: number;
  monthlyContribution: number;
  contributionInflationIndexed: boolean;
  assets: PortfolioAssetInput[];
};

export type BenchmarkInput = {
  selicRate: number;
  taxRate: number;
};

export type MonteCarloInput = {
  nTrajectories: number;
  seed: number | null;
  targetPatrimony: number;
};

export type SimulateInput = {
  capital: number;
  horizon: number;
  reinvest: boolean;
  realEstate: RealEstateInput;
  portfolio: PortfolioInput;
  benchmark: BenchmarkInput;
};

export type SimulateMonteCarloInput = {
  horizon: number;
  realEstate: RealEstateInput;
  portfolio: PortfolioInput;
  mc: MonteCarloInput;
};

// Outputs

export type SimulationResultOut = {
  label: string;
  color: string;
  years: number[];
  patrimony: number[];
  annualIncome: number[];
  cumulativeIncome: number[];
  debtBalance?: number[] | null;
  internalPortfolio?: number[] | null;
};

export type SensitivityRowOut = {
  parameter: string;
  pessimistic: number;
  optimistic: number;
};

export type TaxComparisonRowOut = {
  scenario: string;
  grossIncome: number;
  annualTax: number;
  netIncome: number;
  effectiveTaxBurden: number;
};

export type SimulateOut = {
  realEstate: SimulationResultOut;
  portfolio: SimulationResultOut;
  benchmark: SimulationResultOut;
  sensitivity: SensitivityRowOut[];
  taxComparison: TaxComparisonRowOut[];
};

export type MonteCarloResultOut = {
  label: string;
  color: string;
  p10: number[];
  p50: number[];
  p90: number[];
  finalDistribution: number[];
  maxDrawdowns: number[];
};

export type SimulateMonteCarloOut = {
  realEstate: MonteCarloResultOut;
  portfolio: MonteCarloResultOut;
};

export type MacroOut = {
  selic: number;
  cdi: number;
  ipca: number;
  usdBrl: number;
  isStale: boolean;
  sourceLabel: string;
};

export type ApiError = {
  error: string;
  message: string;
  details?: Record<string, unknown> | null;
};
