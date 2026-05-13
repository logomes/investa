import { describe, it, expect } from "vitest";
import { bySector, sectorConcentration } from "@/lib/sector-derive";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";

const MACRO: MacroOut = {
  selic: 0.12, cdi: 0.12, ipca: 0.04, usdBrl: 5,
  isStale: false, sourceLabel: "test",
};

function position(o: Partial<AssetPosition> & { ticker: string }): AssetPosition {
  const { ticker } = o;
  return {
    id: ticker,
    assetClass: "ACAO_BR_DIVIDENDO",
    currency: "BRL",
    quantity: 100,
    avgPrice: 10,
    expectedYield: 0.08,
    capitalGain: 0.03,
    color: "#5CC8FF",
    ...o,
    ticker,
  };
}

describe("bySector", () => {
  it("retorna lista vazia sem positions", () => {
    expect(bySector([], MACRO)).toEqual([]);
  });

  it("agrupa positions por setor inferido", () => {
    const positions = [
      position({ ticker: "PETR4", avgPrice: 30 }), // Petróleo & Gás
      position({ ticker: "VALE3", avgPrice: 60 }), // Mineração & Siderurgia
      position({ ticker: "ITUB4", avgPrice: 25 }), // Bancos
      position({ ticker: "BBAS3", avgPrice: 50 }), // Bancos
    ];
    const groups = bySector(positions, MACRO);
    const bancos = groups.find((g) => g.sector === "Bancos");
    expect(bancos).toBeDefined();
    expect(bancos!.positions).toBe(2);
    expect(bancos!.totalBRL).toBe(100 * 25 + 100 * 50);
    expect(bancos!.tickers).toEqual(["BBAS3", "ITUB4"]);
  });

  it("calcula weight relativo ao total", () => {
    const positions = [
      position({ ticker: "ITUB4", avgPrice: 30 }), // 3000 - Bancos
      position({ ticker: "VALE3", avgPrice: 70 }), // 7000 - Mineração
    ];
    const groups = bySector(positions, MACRO);
    expect(groups).toHaveLength(2);
    // Ordenado por totalBRL desc → Mineração primeiro
    expect(groups[0].sector).toBe("Mineração & Siderurgia");
    expect(groups[0].weight).toBeCloseTo(0.7);
    expect(groups[1].sector).toBe("Bancos");
    expect(groups[1].weight).toBeCloseTo(0.3);
  });

  it("FIIs caem em 'Imobiliário' (fallback de assetClass)", () => {
    const positions = [
      position({ ticker: "XYZW11", assetClass: "FII", avgPrice: 100 }),
    ];
    const groups = bySector(positions, MACRO);
    expect(groups[0].sector).toBe("Imobiliário");
  });

  it("STOCK_US sem mapping cai em 'Internacional'", () => {
    const positions = [
      position({
        ticker: "AAPL",
        assetClass: "STOCK_US",
        currency: "USD",
        avgPrice: 200,
      }),
    ];
    const groups = bySector(positions, MACRO);
    expect(groups[0].sector).toBe("Internacional");
  });

  it("ETFs caem em 'Diversificado'", () => {
    const positions = [
      position({ ticker: "BOVA11", assetClass: "ETF_BR", avgPrice: 100 }),
    ];
    const groups = bySector(positions, MACRO);
    expect(groups[0].sector).toBe("Diversificado");
  });

  it("ticker desconhecido cai em 'Outros'", () => {
    const positions = [
      position({ ticker: "ABCD3", avgPrice: 50 }),
    ];
    const groups = bySector(positions, MACRO);
    expect(groups[0].sector).toBe("Outros");
  });
});

describe("sectorConcentration", () => {
  it("level=ok com lista vazia", () => {
    const c = sectorConcentration([]);
    expect(c.maxSector).toBeNull();
    expect(c.level).toBe("ok");
    expect(c.maxWeight).toBe(0);
  });

  it("top sector 80% retorna level=critical", () => {
    const c = sectorConcentration([
      { sector: "Mineração & Siderurgia" as const, color: "", positions: 1, totalBRL: 400, weight: 0.80, tickers: [] },
      { sector: "Bancos" as const, color: "", positions: 1, totalBRL: 100, weight: 0.20, tickers: [] },
    ]);
    expect(c.level).toBe("critical");
  });

  it("level=warning quando top sector ∈ [25%, 40%)", () => {
    const groups = [
      { sector: "Bancos" as const, color: "", positions: 2, totalBRL: 350, weight: 0.35, tickers: [] },
    ];
    const c = sectorConcentration(groups);
    expect(c.level).toBe("warning");
    expect(c.maxSector).toBe("Bancos");
    expect(c.maxWeight).toBe(0.35);
  });

  it("level=critical quando top sector >= 40%", () => {
    const groups = [
      { sector: "Imobiliário" as const, color: "", positions: 5, totalBRL: 500, weight: 0.45, tickers: [] },
    ];
    const c = sectorConcentration(groups);
    expect(c.level).toBe("critical");
    expect(c.maxSector).toBe("Imobiliário");
  });

  it("level=ok quando top < threshold de warning", () => {
    const groups = [
      { sector: "Bancos" as const, color: "", positions: 5, totalBRL: 200, weight: 0.20, tickers: [] },
      { sector: "Energia Elétrica" as const, color: "", positions: 3, totalBRL: 180, weight: 0.18, tickers: [] },
    ];
    const c = sectorConcentration(groups);
    expect(c.level).toBe("ok");
    expect(c.maxSector).toBe("Bancos");
  });
});
