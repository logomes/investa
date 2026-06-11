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
  benchmarkNetYield,
  benchmarkLabel,
  ASSET_COLORS,
} from "@/lib/carteira-derive";
import type { PortfolioInput, MacroOut, BenchmarkInput } from "@/lib/api-types";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

const PF: PortfolioInput = DEFAULT_SCENARIO.portfolio;

const CDI_BENCH: BenchmarkInput = { kind: "cdi", annualRate: 0.12, ipcaSpread: 0, taxRate: 0.175 };
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
    expect(normalizedWeights(PF)).toEqual([0.50, 0.20, 0.15, 0.15]);
  });

  it("pesos somando 2 são divididos por 2", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: a.weight * 2 })),
    };
    const w = normalizedWeights(pf);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    expect(w[0]).toBeCloseTo(0.50, 5);
  });

  it("pesos zerados retornam zeros (não NaN)", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: 0 })),
    };
    expect(normalizedWeights(pf)).toEqual([0, 0, 0, 0]);
  });
});

describe("carteira-derive — allocationSegments", () => {
  it("retorna 4 segmentos para defaults (FII consolidado)", () => {
    const segs = allocationSegments(PF);
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.name)).toEqual([
      "FIIs",
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
    // FIIs 50% × 230k = 115k; Aristocrats US (idx 2) 15% × 230k = 34.5k
    expect(segs[0].amount).toBe(115_000);
    expect(segs[2].amount).toBe(34_500);
  });

  it("netYield = expectedYield × (1 - taxRate)", () => {
    const segs = allocationSegments(PF);
    // Aristocrats US (idx 2): 0.04 × (1 - 0.30) = 0.028
    expect(segs[2].netYield).toBeCloseTo(0.04 * 0.7, 5);
  });

  it("color usa ASSET_COLORS pelo índice", () => {
    const segs = allocationSegments(PF);
    expect(segs[0].color).toBe(ASSET_COLORS[0]);
    expect(segs[3].color).toBe(ASSET_COLORS[3]);
  });
});

describe("benchmarkNetYield / benchmarkLabel", () => {
  it("applies the tax rate to the nominal rate", () => {
    expect(benchmarkNetYield(CDI_BENCH)).toBeCloseTo(0.12 * 0.825);
  });

  it("labels each kind", () => {
    expect(benchmarkLabel(CDI_BENCH)).toBe("CDI líquido");
    expect(benchmarkLabel({ ...CDI_BENCH, kind: "selic" })).toBe("Selic líquido");
    expect(benchmarkLabel({ ...CDI_BENCH, kind: "ipca_plus", ipcaSpread: 0.06 })).toBe("IPCA + 6.0% líquido");
  });
});

describe("carteira-derive — yieldComparison", () => {
  it("returns carteira rows plus the benchmark row, no imóvel", () => {
    const rows = yieldComparison({ pf: PF, benchmark: CDI_BENCH });
    expect(rows.map((r) => r.label)).toEqual([
      "Carteira blended",
      "Carteira total (yield + ganho)",
      "CDI líquido",
    ]);
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
