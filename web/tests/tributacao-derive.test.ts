import { describe, it, expect } from "vitest";
import {
  splitTaxRows,
  taxDelta,
  TAX_NOTES,
  SCENARIO_COLORS,
} from "@/lib/tributacao-derive";
import type { TaxComparisonRowOut } from "@/lib/api-types";

const RE_ROW: TaxComparisonRowOut = {
  scenario: "Imóvel",
  grossIncome: 18_000,
  annualTax: 1_237.5,
  netIncome: 16_762.5,
  effectiveTaxBurden: 0.0688,
};

const RE_FINANCED_ROW: TaxComparisonRowOut = {
  ...RE_ROW,
  scenario: "Imóvel (financiado)",
};

const PF_ROW: TaxComparisonRowOut = {
  scenario: "Carteira Diversificada",
  grossIncome: 27_945,
  annualTax: 414,
  netIncome: 27_531,
  effectiveTaxBurden: 0.0148,
};

describe("tributacao-derive — splitTaxRows", () => {
  it('localiza "Imóvel" e "Carteira Diversificada"', () => {
    const split = splitTaxRows([RE_ROW, PF_ROW]);
    expect(split.realEstate?.scenario).toBe("Imóvel");
    expect(split.portfolio?.scenario).toBe("Carteira Diversificada");
  });

  it('localiza "Imóvel (financiado)" pelo prefix', () => {
    const split = splitTaxRows([RE_FINANCED_ROW, PF_ROW]);
    expect(split.realEstate?.scenario).toBe("Imóvel (financiado)");
    expect(split.portfolio?.scenario).toBe("Carteira Diversificada");
  });

  it("retorna nulls quando array vazio", () => {
    expect(splitTaxRows([])).toEqual({ realEstate: null, portfolio: null });
  });

  it("retorna realEstate null se só houver carteira", () => {
    expect(splitTaxRows([PF_ROW])).toEqual({
      realEstate: null,
      portfolio: PF_ROW,
    });
  });
});

describe("tributacao-derive — taxDelta", () => {
  it("Imóvel paga mais imposto absoluto → realEstatePaysMore = true", () => {
    const d = taxDelta(RE_ROW, PF_ROW);
    expect(d.realEstatePaysMore).toBe(true);
    expect(d.taxDiffAbs).toBeCloseTo(1_237.5 - 414, 2);
  });

  it("Imóvel paga menos → realEstatePaysMore = false", () => {
    const reIsento = { ...RE_ROW, annualTax: 0, effectiveTaxBurden: 0 };
    const pfHigh   = { ...PF_ROW, annualTax: 5_000, effectiveTaxBurden: 0.18 };
    const d = taxDelta(reIsento, pfHigh);
    expect(d.realEstatePaysMore).toBe(false);
    expect(d.taxDiffAbs).toBe(-5_000);
  });

  it("burdenDiffPp = re.effectiveTaxBurden - pf.effectiveTaxBurden", () => {
    const d = taxDelta(RE_ROW, PF_ROW);
    expect(d.burdenDiffPp).toBeCloseTo(0.0688 - 0.0148, 5);
  });
});

describe("tributacao-derive — TAX_NOTES + SCENARIO_COLORS", () => {
  it("TAX_NOTES tem 5 entradas com title + body não-vazios", () => {
    expect(TAX_NOTES).toHaveLength(5);
    TAX_NOTES.forEach((n) => {
      expect(n.title).toBeTruthy();
      expect(n.body).toBeTruthy();
    });
  });

  it("SCENARIO_COLORS expõe realEstate / portfolio / tax como hex válidos", () => {
    expect(SCENARIO_COLORS.realEstate).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.portfolio).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.tax).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
