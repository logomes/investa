// Mirror of api/schemas/inputs.py and api/schemas/outputs.py.
// camelCase field names match the Pydantic alias_generator output.

export type DisplayMode = "real" | "nominal";

export type TaxProfile =
  | "isento" | "fii" | "acoes_br" | "rf_regressiva"
  | "come_cotas" | "dividendos_exterior" | "tributado_anual";

export type PortfolioAssetInput = {
  name: string;
  weight: number;
  expectedYield: number;
  capitalGain: number;
  taxRate: number;
  note: string;
  volatility: number;
  taxProfile: TaxProfile;
};

export type PortfolioInput = {
  capital: number;
  monthlyContribution: number;
  contributionInflationIndexed: boolean;
  assets: PortfolioAssetInput[];
};

export type BenchmarkKind = "cdi" | "selic" | "ipca_plus";

export type BenchmarkInput = {
  kind: BenchmarkKind;
  annualRate: number;
  ipcaSpread: number;
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
  expectedInflation: number;
  portfolio: PortfolioInput;
  benchmark: BenchmarkInput;
};

export type SimulateMonteCarloInput = {
  horizon: number;
  expectedInflation: number;
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
  grossPatrimony: number[];
  taxPaidCumulative: number[];
  exitTax: number[];
};

export type SensitivityRowOut = {
  parameter: string;
  pessimistic: number;
  optimistic: number;
};

export type TaxProjectionRowOut = {
  name: string; taxProfile: string; taxPaidPath: number;
  exitTax: number; netFinal: number; grossFinal: number;
};

export type TaxProjectionOut = {
  rows: TaxProjectionRowOut[]; taxPaidByYear: number[];
  exitTaxByYear: number[]; allTaxedFinal: number;
};

export type SimulateOut = {
  portfolio: SimulationResultOut;
  benchmark: SimulationResultOut;
  sensitivity: SensitivityRowOut[];
  taxProjection: TaxProjectionOut;
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

export type QuoteOut = {
  ticker: string;
  market: "BR" | "US";
  price: number;
  currency: string;
  asOf: string; // ISO 8601
  source: string;
};

export type GoalSolveInput = {
  horizon: number;
  expectedInflation: number;
  portfolio: PortfolioInput;
  goalTarget: number;
  confidence: number;
  nTrajectories: number;
};

export type GoalSolveOut = {
  requiredMonthlyContribution: number;
  achievedProbability: number;
  attainable: boolean;
  iterations: number;
};
