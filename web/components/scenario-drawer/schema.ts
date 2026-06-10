import { z } from "zod";

export const financingSchema = z.object({
  termYears: z.number().int().min(1).max(40),
  annualRate: z.number().min(0).max(1),
  entryPct: z.number().min(0).max(1),
  system: z.enum(["SAC", "Price"]),
  monthlyInsuranceRate: z.number().min(0).max(0.01),
});

export const realEstateSchema = z.object({
  propertyValue: z.number().positive(),
  monthlyRent: z.number().min(0),
  annualAppreciation: z.number().min(-0.5).max(1),
  iptuRate: z.number().min(0).max(0.5),
  vacancyMonthsPerYear: z.number().min(0).max(12),
  managementFeePct: z.number().min(0).max(1),
  maintenanceAnnual: z.number().min(0),
  insuranceAnnual: z.number().min(0),
  incomeTaxBracket: z.number().min(0).max(0.5),
  acquisitionCostPct: z.number().min(0).max(0.5),
  appreciationVolatility: z.number().min(0).max(1),
  financing: financingSchema.nullable(),
});

export const portfolioAssetSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  expectedYield: z.number().min(-1).max(1),
  capitalGain: z.number(),
  taxRate: z.number().min(0).max(1),
  note: z.string(),
  volatility: z.number().min(0).max(1),
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
  taxRate: z.number().min(0).max(1),
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
  realEstate: realEstateSchema,
  portfolio: portfolioSchema,
  benchmark: benchmarkSchema,
  mc: monteCarloSchema,
});

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;
