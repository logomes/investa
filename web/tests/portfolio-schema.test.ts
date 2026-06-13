import { describe, it, expect } from "vitest";
import { portfolioSchema } from "@/components/scenario-drawer/schema";

const baseAsset = {
  expectedYield: 0.1,
  capitalGain: 0,
  taxRate: 0,
  note: "",
  volatility: 0.1,
  taxProfile: "tributado_anual" as const,
};

const makePortfolio = (assets: Array<{ name: string; weight: number }>) => ({
  capital: 100_000,
  monthlyContribution: 0,
  contributionInflationIndexed: false,
  assets: assets.map((a) => ({ ...baseAsset, ...a })),
});

describe("portfolioSchema validation", () => {
  it("accepts assets whose weights sum to exactly 1.0", () => {
    const result = portfolioSchema.safeParse(
      makePortfolio([
        { name: "A", weight: 0.5 },
        { name: "B", weight: 0.3 },
        { name: "C", weight: 0.2 },
      ])
    );
    expect(result.success).toBe(true);
  });

  it("accepts weights that sum within ±0.001 tolerance (float drift)", () => {
    const result = portfolioSchema.safeParse(
      makePortfolio([
        { name: "A", weight: 0.1 },
        { name: "B", weight: 0.2 },
        { name: "C", weight: 0.3 },
        { name: "D", weight: 0.4 },
      ])
    );
    expect(result.success).toBe(true);
  });

  it("rejects when sum is below tolerance", () => {
    const result = portfolioSchema.safeParse(
      makePortfolio([
        { name: "A", weight: 0.5 },
        { name: "B", weight: 0.3 },
      ])
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/100%/);
    }
  });

  it("rejects more than 12 assets", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => ({
      name: `A${i}`,
      weight: 1 / 13,
    }));
    const result = portfolioSchema.safeParse(makePortfolio(thirteen));
    expect(result.success).toBe(false);
  });
});
