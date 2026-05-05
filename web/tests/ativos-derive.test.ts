import { describe, it, expect } from "vitest";
import {
  positionValueBRL,
  ativosKpis,
  byAssetClass,
  byMarket,
} from "@/lib/ativos-derive";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";

const MACRO: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

const FII_PAPEL: AssetPosition = {
  id: "1",
  ticker: "HGCR11",
  assetClass: "FII_PAPEL",
  currency: "BRL",
  quantity: 100,
  avgPrice: 100,
  expectedYield: 0.13,
  capitalGain: 0,
  color: "#FFC857",
};

const FII_PAPEL_2: AssetPosition = {
  id: "2",
  ticker: "KNCR11",
  assetClass: "FII_PAPEL",
  currency: "BRL",
  quantity: 50,
  avgPrice: 200,
  expectedYield: 0.12,
  capitalGain: 0,
  color: "#FFC857",
};

const STOCK_US: AssetPosition = {
  id: "3",
  ticker: "JNJ",
  assetClass: "STOCK_US",
  currency: "USD",
  quantity: 10,
  avgPrice: 150,
  expectedYield: 0.032,
  capitalGain: 0.05,
  color: "#7DCFFF",
};

describe("ativos-derive — positionValueBRL", () => {
  it("BRL passa direto", () => {
    expect(positionValueBRL(FII_PAPEL, MACRO)).toBe(10_000);
  });

  it("USD multiplica por usdBrl", () => {
    expect(positionValueBRL(STOCK_US, MACRO)).toBe(10 * 150 * 5.30);
  });
});

describe("ativos-derive — ativosKpis", () => {
  it("array vazio → tudo 0", () => {
    const k = ativosKpis([], MACRO);
    expect(k.totalAllocated).toBe(0);
    expect(k.blendedYield).toBe(0);
    expect(k.blendedCapitalGain).toBe(0);
    expect(k.totalReturn).toBe(0);
  });

  it("FII Papel (taxRate=0) → blendedYield = expectedYield total", () => {
    const k = ativosKpis([FII_PAPEL], MACRO);
    expect(k.totalAllocated).toBe(10_000);
    expect(k.blendedYield).toBeCloseTo(0.13, 5);
    expect(k.blendedCapitalGain).toBe(0);
    expect(k.totalReturn).toBeCloseTo(0.13, 5);
  });

  it("Stock US (taxRate=0.30) → blendedYield reduzido em 30%", () => {
    const k = ativosKpis([STOCK_US], MACRO);
    // blendedYield = 0.032 * (1 - 0.30) = 0.0224
    expect(k.blendedYield).toBeCloseTo(0.0224, 5);
    expect(k.blendedCapitalGain).toBeCloseTo(0.05, 5);
  });

  it("mix FII + Stock US → blendedYield ponderado por valor BRL", () => {
    const k = ativosKpis([FII_PAPEL, STOCK_US], MACRO);
    const fiiVal = 10_000;
    const usVal = 10 * 150 * 5.30;
    const total = fiiVal + usVal;
    const expectedYield = (fiiVal / total) * 0.13 + (usVal / total) * 0.032 * 0.70;
    expect(k.blendedYield).toBeCloseTo(expectedYield, 5);
  });

  it("totalReturn = blendedYield + blendedCapitalGain", () => {
    const k = ativosKpis([FII_PAPEL, STOCK_US], MACRO);
    expect(k.totalReturn).toBeCloseTo(k.blendedYield + k.blendedCapitalGain, 5);
  });
});

describe("ativos-derive — byAssetClass", () => {
  it("agrega 2 posições da mesma classe", () => {
    const groups = byAssetClass([FII_PAPEL, FII_PAPEL_2], MACRO);
    expect(groups).toHaveLength(1);
    expect(groups[0].assetClass).toBe("FII_PAPEL");
    expect(groups[0].positions).toBe(2);
    expect(groups[0].totalBRL).toBe(10_000 + 10_000);
    expect(groups[0].weight).toBe(1);
  });

  it("ordena por totalBRL desc", () => {
    const groups = byAssetClass([FII_PAPEL, STOCK_US], MACRO);
    // STOCK_US BRL = 10*150*5.30 = 7950; FII_PAPEL = 10000. So FII first.
    expect(groups[0].assetClass).toBe("FII_PAPEL");
    expect(groups[1].assetClass).toBe("STOCK_US");
    expect(groups[0].totalBRL).toBeGreaterThan(groups[1].totalBRL);
  });

  it("weights somam 1", () => {
    const groups = byAssetClass([FII_PAPEL, FII_PAPEL_2, STOCK_US], MACRO);
    const sumWeights = groups.reduce((s, g) => s + g.weight, 0);
    expect(sumWeights).toBeCloseTo(1, 5);
  });
});

describe("ativos-derive — byMarket", () => {
  it("BR/US split correto com USD convertido", () => {
    const split = byMarket([FII_PAPEL, STOCK_US], MACRO);
    expect(split.br.totalBRL).toBe(10_000);
    expect(split.br.positions).toBe(1);
    expect(split.us.totalBRL).toBe(10 * 150 * 5.30);
    expect(split.us.positions).toBe(1);
    expect(split.br.weight + split.us.weight).toBeCloseTo(1, 5);
  });

  it("array vazio → ambos 0, weights 0", () => {
    const split = byMarket([], MACRO);
    expect(split.br.totalBRL).toBe(0);
    expect(split.us.totalBRL).toBe(0);
    expect(split.br.weight).toBe(0);
    expect(split.us.weight).toBe(0);
  });
});
