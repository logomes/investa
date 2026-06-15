import { z } from "zod";

export const portfolioAssetSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  expectedYield: z.number().min(-1).max(1),
  capitalGain: z.number(),
  taxRate: z.number().min(0).max(1),
  note: z.string(),
  volatility: z.number().min(0).max(1),
  taxProfile: z.enum(["isento", "fii", "acoes_br", "rf_regressiva", "come_cotas", "dividendos_exterior", "tributado_anual"]),
});

export const portfolioSchema = z
  .object({
    capital: z.number().positive(),
    monthlyContribution: z.number().min(0),
    contributionInflationIndexed: z.boolean(),
    assets: z.array(portfolioAssetSchema).min(1).max(12),
  })
  .refine(
    (p) => {
      const sum = p.assets.reduce((acc, a) => acc + a.weight, 0);
      return Math.abs(sum - 1) <= 0.001;
    },
    { message: "soma dos pesos deve ser 100%" }
  );

export const benchmarkSchema = z.object({
  kind: z.enum(["cdi", "selic", "ipca_plus"]),
  annualRate: z.number().min(0).max(1),
  ipcaSpread: z.number().min(0).max(0.5),
});

export const monteCarloSchema = z.object({
  nTrajectories: z.number().int().min(100).max(50_000),
  seed: z.number().int().nullable(),
  targetPatrimony: z.number().min(0),
});

export const scenarioFormSchema = z.object({
  capital: z.number().positive(),
  horizon: z.number().int().min(1).max(30),
  reinvest: z.boolean(),
  expectedInflation: z.number().min(0).max(0.5),
  portfolio: portfolioSchema,
  benchmark: benchmarkSchema,
  mc: monteCarloSchema,
});

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;
