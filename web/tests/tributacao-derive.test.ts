import { describe, it, expect } from "vitest";
import {
  totalContributed,
  taxKpis,
  TAX_NOTES,
  TAX_PROFILE_LABEL,
  SCENARIO_COLORS,
} from "@/lib/tributacao-derive";
import type { SimulateInput, SimulateOut } from "@/lib/api-types";

function makeScenario(over: {
  capital?: number;
  horizon?: number;
  expectedInflation?: number;
  monthlyContribution?: number;
  contributionInflationIndexed?: boolean;
}): SimulateInput {
  return {
    capital: over.capital ?? 100_000,
    horizon: over.horizon ?? 10,
    reinvest: true,
    expectedInflation: over.expectedInflation ?? 0.04,
    portfolio: {
      capital: over.capital ?? 100_000,
      monthlyContribution: over.monthlyContribution ?? 0,
      contributionInflationIndexed: over.contributionInflationIndexed ?? false,
      assets: [],
    },
    benchmark: { kind: "cdi", annualRate: 0.1, ipcaSpread: 0 },
  };
}

describe("totalContributed", () => {
  it("lump-sum (no monthly) = capital", () => {
    expect(totalContributed(makeScenario({ capital: 250_000 }))).toBe(250_000);
  });

  it("flat monthly = capital + horizon · 12 · monthly", () => {
    const sc = makeScenario({ capital: 100_000, horizon: 5, monthlyContribution: 1_000 });
    expect(totalContributed(sc)).toBe(100_000 + 5 * 12 * 1_000);
  });

  it("indexed monthly grows by ipca each year (begin-of-year)", () => {
    const ipca = 0.04;
    const monthly = 1_000;
    const horizon = 3;
    const sc = makeScenario({
      capital: 50_000,
      horizon,
      expectedInflation: ipca,
      monthlyContribution: monthly,
      contributionInflationIndexed: true,
    });
    const annual = 12 * monthly;
    let expected = 50_000;
    for (let t = 0; t < horizon; t++) expected += annual * Math.pow(1 + ipca, t);
    expect(totalContributed(sc)).toBeCloseTo(expected, 6);
  });
});

function makeSimOut(over: {
  taxPaidByYear: number[];
  exitTaxByYear: number[];
  grossFinal: number;
  netFinal: number;
  allTaxedFinal: number;
}): SimulateOut {
  const last = over.taxPaidByYear.length;
  const filler = Array.from({ length: last }, () => 0);
  const grossPatrimony = [...filler];
  grossPatrimony[last - 1] = over.grossFinal;
  const patrimony = [...filler];
  patrimony[last - 1] = over.netFinal;
  const result = {
    label: "",
    color: "",
    years: filler.map((_, i) => i),
    patrimony,
    annualIncome: filler,
    cumulativeIncome: filler,
    grossPatrimony,
    taxPaidCumulative: filler,
    exitTax: filler,
  };
  return {
    portfolio: result,
    benchmark: result,
    sensitivity: [],
    taxProjection: {
      rows: [],
      taxPaidByYear: over.taxPaidByYear,
      exitTaxByYear: over.exitTaxByYear,
      allTaxedFinal: over.allTaxedFinal,
    },
  };
}

describe("taxKpis", () => {
  it("totalTax = path + exit at horizon; effectiveRate vs gain; exemptionValue = net − allTaxed", () => {
    const sim = makeSimOut({
      taxPaidByYear: [0, 500, 1_200],
      exitTaxByYear: [0, 200, 800],
      grossFinal: 30_000,
      netFinal: 28_000,
      allTaxedFinal: 25_000,
    });
    const contributed = 20_000;
    const k = taxKpis(sim, contributed);
    expect(k.totalTax).toBe(1_200 + 800);
    expect(k.latentExitTax).toBe(800);
    // gain = 30_000 − 20_000 = 10_000
    expect(k.effectiveRate).toBeCloseTo(2_000 / 10_000, 6);
    expect(k.exemptionValue).toBe(28_000 - 25_000);
  });

  it("gain <= 0 → effectiveRate is 0", () => {
    const sim = makeSimOut({
      taxPaidByYear: [0, 1_000],
      exitTaxByYear: [0, 500],
      grossFinal: 18_000,
      netFinal: 17_000,
      allTaxedFinal: 16_000,
    });
    const k = taxKpis(sim, 20_000); // gain negative
    expect(k.effectiveRate).toBe(0);
    expect(k.totalTax).toBe(1_500);
  });
});

describe("tributacao-derive — constants", () => {
  it("TAX_NOTES inclui nota de come-cotas e não tem entrada Aluguel (PF)", () => {
    expect(TAX_NOTES.length).toBeGreaterThanOrEqual(1);
    expect(TAX_NOTES.find((n) => /come-cotas/i.test(n.body))).toBeTruthy();
    expect(TAX_NOTES.find((n) => n.title === "Aluguel (PF)")).toBeUndefined();
    TAX_NOTES.forEach((n) => {
      expect(n.title).toBeTruthy();
      expect(n.body).toBeTruthy();
    });
  });

  it("SCENARIO_COLORS expõe benchmark / portfolio / tax como hex válidos", () => {
    expect(SCENARIO_COLORS.benchmark).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.portfolio).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.tax).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("TAX_PROFILE_LABEL mapeia os perfis conhecidos", () => {
    expect(TAX_PROFILE_LABEL.come_cotas).toBe("Come-cotas");
    expect(TAX_PROFILE_LABEL.isento).toBe("Isento");
    expect(TAX_PROFILE_LABEL.acoes_br).toBe("Ações BR");
  });
});
