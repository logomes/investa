import { describe, it, expect } from "vitest";
import {
  splitTaxRows,
  taxDelta,
  TAX_NOTES,
  SCENARIO_COLORS,
} from "@/lib/tributacao-derive";
import type { TaxComparisonRowOut } from "@/lib/api-types";

const PF_ROW: TaxComparisonRowOut = {
  scenario: "Carteira Diversificada", grossIncome: 10_000, annualTax: 2_000,
  netIncome: 8_000, effectiveTaxBurden: 0.20,
};
const BENCH_ROW: TaxComparisonRowOut = {
  scenario: "CDI (líquido)", grossIncome: 12_000, annualTax: 2_100,
  netIncome: 9_900, effectiveTaxBurden: 0.175,
};

describe("splitTaxRows", () => {
  it("splits into portfolio and benchmark", () => {
    const { portfolio, benchmark } = splitTaxRows([PF_ROW, BENCH_ROW]);
    expect(portfolio).toEqual(PF_ROW);
    expect(benchmark).toEqual(BENCH_ROW);
  });

  it("returns nulls when rows are missing", () => {
    expect(splitTaxRows([])).toEqual({ portfolio: null, benchmark: null });
  });

  it("returns null benchmark when only the portfolio row exists", () => {
    expect(splitTaxRows([PF_ROW])).toEqual({ portfolio: PF_ROW, benchmark: null });
  });
});

describe("taxDelta", () => {
  it("computes portfolio − benchmark", () => {
    const d = taxDelta(PF_ROW, BENCH_ROW);
    expect(d.taxDiffAbs).toBeCloseTo(-100);
    expect(d.burdenDiffPp).toBeCloseTo(0.025);
    expect(d.portfolioPaysMore).toBe(false);
  });

  it("flags portfolioPaysMore when the carteira tax is higher", () => {
    const d = taxDelta({ ...PF_ROW, annualTax: 3_000 }, BENCH_ROW);
    expect(d.taxDiffAbs).toBeCloseTo(900);
    expect(d.portfolioPaysMore).toBe(true);
  });
});

describe("tributacao-derive — TAX_NOTES + SCENARIO_COLORS", () => {
  it("TAX_NOTES tem 4 entradas com title + body não-vazios", () => {
    expect(TAX_NOTES).toHaveLength(4);
    TAX_NOTES.forEach((n) => {
      expect(n.title).toBeTruthy();
      expect(n.body).toBeTruthy();
    });
  });

  it("TAX_NOTES não contém entrada Aluguel (PF)", () => {
    expect(TAX_NOTES.find((n) => n.title === "Aluguel (PF)")).toBeUndefined();
  });

  it("SCENARIO_COLORS expõe benchmark / portfolio / tax como hex válidos", () => {
    expect(SCENARIO_COLORS.benchmark).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.portfolio).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.tax).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
