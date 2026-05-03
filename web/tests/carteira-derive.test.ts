import { describe, it, expect } from "vitest";
import {
  blendedYield,
  blendedCapitalGain,
  totalReturn,
  annualIncome,
  normalizedWeights,
  allocationSegments,
  yieldComparison,
  yieldRefLines,
  ASSET_COLORS,
} from "@/lib/carteira-derive";
import type { PortfolioInput, RealEstateInput, MacroOut } from "@/lib/api-types";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

const PF: PortfolioInput = DEFAULT_SCENARIO.portfolio;
const RE: RealEstateInput = DEFAULT_SCENARIO.realEstate;
const MACRO: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

describe("carteira-derive — KPIs blended", () => {
  it("blendedYield ≈ 9,27% para defaults", () => {
    expect(blendedYield(PF)).toBeCloseTo(0.092725, 5);
  });

  it("blendedCapitalGain ≈ 2,0% para defaults", () => {
    expect(blendedCapitalGain(PF)).toBeCloseTo(0.020, 5);
  });

  it("totalReturn = blendedYield + blendedCapitalGain", () => {
    expect(totalReturn(PF)).toBeCloseTo(0.092725 + 0.020, 5);
  });

  it("annualIncome = capital × blendedYield", () => {
    expect(annualIncome(PF)).toBeCloseTo(21_326.75, 1);
  });

  it("annualIncome = 0 quando capital = 0", () => {
    expect(annualIncome({ ...PF, capital: 0 })).toBe(0);
  });

  it("IR=100% (taxRate=1) zera contribuição daquele asset ao blendedYield", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: [
        { name: "A", weight: 1.0, expectedYield: 0.10, capitalGain: 0, taxRate: 1.0, note: "", volatility: 0.1 },
      ],
    };
    expect(blendedYield(pf)).toBe(0);
  });
});

describe("carteira-derive — normalizedWeights", () => {
  it("pesos somando 1 ficam iguais", () => {
    expect(normalizedWeights(PF)).toEqual([0.25, 0.25, 0.20, 0.15, 0.15]);
  });

  it("pesos somando 2 são divididos por 2", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: a.weight * 2 })),
    };
    const w = normalizedWeights(pf);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    expect(w[0]).toBeCloseTo(0.25, 5);
  });

  it("pesos zerados retornam zeros (não NaN)", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: 0 })),
    };
    expect(normalizedWeights(pf)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("carteira-derive — allocationSegments", () => {
  it("retorna 5 segmentos para defaults", () => {
    const segs = allocationSegments(PF);
    expect(segs).toHaveLength(5);
    expect(segs.map((s) => s.name)).toEqual([
      "FIIs de Papel",
      "FIIs de Tijolo",
      "Ações BR Dividendos",
      "Dividend Aristocrats US",
      "Tesouro IPCA+ / LCI",
    ]);
  });

  it("Σ weight = 1 e Σ amount = capital", () => {
    const segs = allocationSegments(PF);
    expect(segs.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 5);
    expect(segs.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(PF.capital, 1);
  });

  it("amount = capital × weight", () => {
    const segs = allocationSegments(PF);
    expect(segs[0].amount).toBe(57_500);
    expect(segs[3].amount).toBe(34_500);
  });

  it("netYield = expectedYield × (1 - taxRate)", () => {
    const segs = allocationSegments(PF);
    expect(segs[3].netYield).toBeCloseTo(0.04 * 0.7, 5);
  });

  it("color usa ASSET_COLORS pelo índice", () => {
    const segs = allocationSegments(PF);
    expect(segs[0].color).toBe(ASSET_COLORS[0]);
    expect(segs[4].color).toBe(ASSET_COLORS[4]);
  });
});

describe("carteira-derive — yieldComparison", () => {
  it("retorna 4 entradas em ordem fixa", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.label)).toEqual([
      "Carteira blended",
      "Imóvel bruto",
      "Imóvel líquido",
      "Tesouro Selic líquido",
    ]);
  });

  it("Carteira blended bate com blendedYield(pf)", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows[0].value).toBeCloseTo(blendedYield(PF), 5);
  });

  it("Tesouro Selic líquido = selic × (1 - benchmarkTaxRate)", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows[3].value).toBeCloseTo(0.1475 * 0.825, 5);
  });
});

describe("carteira-derive — yieldRefLines", () => {
  it("retorna Selic + IPCA do macro", () => {
    const lines = yieldRefLines(MACRO);
    expect(lines).toEqual([
      { label: "Selic", value: 0.1475 },
      { label: "IPCA", value: 0.0414 },
    ]);
  });
});

describe("carteira-derive — paleta", () => {
  it("ASSET_COLORS tem ao menos 5 entradas hex", () => {
    expect(ASSET_COLORS.length).toBeGreaterThanOrEqual(5);
    ASSET_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/i));
  });
});
