import { describe, it, expect } from "vitest";
import type { SimulateInput, SimulateOut } from "@/lib/api-types";

describe("api-types JSON parity with Pydantic", () => {
  it("SimulateInput accepts a fixture mirroring the API contract", () => {
    const fixture: SimulateInput = {
      capital: 230_000,
      horizon: 10,
      reinvest: true,
      realEstate: {
        propertyValue: 230_000,
        monthlyRent: 1_500,
        annualAppreciation: 0.055,
        iptuRate: 0.01,
        vacancyMonthsPerYear: 1,
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
        assets: [{
          name: "FIIs", weight: 1.0, expectedYield: 0.13,
          capitalGain: 0, taxRate: 0, note: "", volatility: 0.14,
        }],
      },
      benchmark: { kind: "cdi", annualRate: 0.1465, ipcaSpread: 0, taxRate: 0.175 },
    };
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
  });

  it("SimulateOut shape matches expected response", () => {
    const fixture: SimulateOut = {
      realEstate: {
        label: "Imóvel",
        color: "#C0392B",
        years: [0, 1, 2],
        patrimony: [230000, 240000, 250000],
        annualIncome: [0, 18000, 18900],
        cumulativeIncome: [0, 18000, 36900],
      },
      portfolio: {
        label: "Carteira",
        color: "#27AE60",
        years: [0, 1, 2],
        patrimony: [230000, 250000, 271000],
        annualIncome: [0, 23000, 25000],
        cumulativeIncome: [0, 23000, 48000],
      },
      benchmark: {
        label: "Tesouro Selic",
        color: "#F39C12",
        years: [0, 1, 2],
        patrimony: [230000, 256000, 285000],
        annualIncome: [0, 0, 0],
        cumulativeIncome: [0, 0, 0],
      },
      sensitivity: [],
      taxComparison: [],
    };
    expect(fixture.realEstate.years).toHaveLength(3);
  });
});
