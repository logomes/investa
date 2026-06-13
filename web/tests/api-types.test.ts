import { describe, it, expect } from "vitest";
import type { SimulateInput, SimulateOut, GoalSolveOut } from "@/lib/api-types";

describe("api-types JSON parity with Pydantic", () => {
  it("SimulateInput accepts a fixture mirroring the API contract", () => {
    const fixture: SimulateInput = {
      capital: 230_000,
      horizon: 10,
      reinvest: true,
      expectedInflation: 0.045,
      portfolio: {
        capital: 230_000,
        monthlyContribution: 0,
        contributionInflationIndexed: true,
        assets: [{
          name: "FIIs", weight: 1.0, expectedYield: 0.13,
          capitalGain: 0, taxRate: 0, note: "", volatility: 0.14, taxProfile: "fii",
        }],
      },
      benchmark: { kind: "cdi", annualRate: 0.1465, ipcaSpread: 0, taxRate: 0.175 },
    };
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
  });

  it("SimulateOut shape matches expected response", () => {
    const fixture: SimulateOut = {
      portfolio: {
        label: "Carteira",
        color: "#27AE60",
        years: [0, 1, 2],
        patrimony: [230000, 250000, 271000],
        annualIncome: [0, 23000, 25000],
        cumulativeIncome: [0, 23000, 48000],
        grossPatrimony: [230000, 250000, 271000],
        taxPaidCumulative: [0, 0, 0],
        exitTax: [0, 0, 0],
      },
      benchmark: {
        label: "Tesouro Selic",
        color: "#F39C12",
        years: [0, 1, 2],
        patrimony: [230000, 256000, 285000],
        annualIncome: [0, 0, 0],
        cumulativeIncome: [0, 0, 0],
        grossPatrimony: [230000, 256000, 285000],
        taxPaidCumulative: [0, 0, 0],
        exitTax: [0, 0, 0],
      },
      sensitivity: [],
      taxComparison: [],
    };
    expect(fixture.portfolio.years).toHaveLength(3);
  });

  it("GoalSolveOut shape matches expected response", () => {
    const fixture: GoalSolveOut = {
      requiredMonthlyContribution: 1500,
      achievedProbability: 0.85,
      attainable: true,
      iterations: 42,
    };
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
  });
});
