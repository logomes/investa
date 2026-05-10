import { describe, it, expect } from "vitest";
import {
  positionValueBRL,
  unrealizedGain,
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

const ETF_BR_POS: AssetPosition = {
  id: "4",
  ticker: "BOVA11",
  assetClass: "ETF_BR",
  currency: "BRL",
  quantity: 100,
  avgPrice: 100,
  expectedYield: 0.04,
  capitalGain: 0.10,
  color: "#C39BD3",
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

  it("ETF_BR pinning: taxRate (0.15) é aplicado em yield, capitalGain fica bruto", () => {
    // Documenta a convenção atual. Se um dia ASSET_CLASS_META.taxRate for splittado em
    // yieldTaxRate/capitalGainTaxRate, este teste deve falhar e ser revisado.
    const k = ativosKpis([ETF_BR_POS], MACRO);
    expect(k.blendedYield).toBeCloseTo(0.04 * 0.85, 5);    // yield com haircut
    expect(k.blendedCapitalGain).toBeCloseTo(0.10, 5);      // gain bruto
  });
});

describe("ativos-derive — byAssetClass", () => {
  it("array vazio → []", () => {
    expect(byAssetClass([], MACRO)).toEqual([]);
  });

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

describe("unrealizedGain", () => {
  it("retorna null quando não há currentPrice", () => {
    const p: AssetPosition = { ...FII_PAPEL, currentPrice: undefined };
    expect(unrealizedGain(p, MACRO)).toBeNull();
  });

  it("BRL: ganho positivo quando currentPrice > avgPrice", () => {
    const p: AssetPosition = { ...FII_PAPEL, quantity: 100, avgPrice: 100, currentPrice: 110 };
    const g = unrealizedGain(p, MACRO);
    expect(g?.gainBRL).toBeCloseTo(1000, 2); // (110-100)*100
    expect(g?.gainPct).toBeCloseTo(0.10, 5); // 10%
  });

  it("BRL: perda quando currentPrice < avgPrice", () => {
    const p: AssetPosition = { ...FII_PAPEL, quantity: 100, avgPrice: 100, currentPrice: 90 };
    const g = unrealizedGain(p, MACRO);
    expect(g?.gainBRL).toBeCloseTo(-1000, 2);
    expect(g?.gainPct).toBeCloseTo(-0.10, 5);
  });

  it("USD: ganho computado em USD e convertido por usdBrl", () => {
    const p: AssetPosition = {
      ...FII_PAPEL, currency: "USD", quantity: 10, avgPrice: 200, currentPrice: 250,
      assetClass: "STOCK_US",
    };
    const g = unrealizedGain(p, MACRO);
    // (250-200)*10 = 500 USD * 5.30 = 2650 BRL
    expect(g?.gainBRL).toBeCloseTo(2650, 2);
    expect(g?.gainPct).toBeCloseTo(0.25, 5); // 25% native
  });

  it("currentPrice = 0 retorna null (preço inválido)", () => {
    const p: AssetPosition = { ...FII_PAPEL, currentPrice: 0 };
    expect(unrealizedGain(p, MACRO)).toBeNull();
  });

  it("avgPrice = 0 não quebra (gainPct = 0)", () => {
    const p: AssetPosition = { ...FII_PAPEL, avgPrice: 0.0001, currentPrice: 100 };
    const g = unrealizedGain(p, MACRO);
    expect(Number.isFinite(g?.gainPct ?? Infinity)).toBe(true);
  });
});
