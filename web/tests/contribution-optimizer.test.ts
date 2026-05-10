import { describe, it, expect } from "vitest";
import { planContribution } from "@/lib/contribution-optimizer";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";

const macro: MacroOut = {
  selic: 0.105, cdi: 0.104, ipca: 0.045, usdBrl: 5.20, isStale: false, sourceLabel: "test",
};

function pos(overrides: Partial<AssetPosition>): AssetPosition {
  return {
    id: overrides.ticker ?? "x",
    ticker: "X",
    assetClass: "ACAO_BR_DIVIDENDO",
    currency: "BRL",
    quantity: 1,
    avgPrice: 1,
    expectedYield: 0,
    capitalGain: 0,
    color: "#fff",
    ...overrides,
  };
}

describe("planContribution", () => {
  it("retorna lista vazia quando não há posições", () => {
    const plan = planContribution([], macro, 1000);
    expect(plan.byClass).toEqual([]);
    expect(plan.totalCurrentBRL).toBe(0);
    expect(plan.totalProjectedBRL).toBe(1000);
  });

  it("balanced: aporte vai 100% pra classe sub-alocada", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 30 }), // 3000 BRL
      pos({ ticker: "B", assetClass: "FII_PAPEL", quantity: 10, avgPrice: 100 }),         // 1000 BRL
    ];
    // Total 4000, balanced target = 50% / 50%, ACAO está em 75% (super), FII em 25% (sub)
    // Aporte 1000 → tudo pra FII (sub-alocada)
    const plan = planContribution(positions, macro, 1000, "balanced");
    const fii = plan.byClass.find((c) => c.assetClass === "FII_PAPEL");
    const acao = plan.byClass.find((c) => c.assetClass === "ACAO_BR_DIVIDENDO");
    expect(fii?.suggestedR$).toBeGreaterThan(900); // grande maioria do aporte
    expect(acao?.suggestedR$ ?? 0).toBeLessThan(100);
  });

  it("balanced: já balanceado → distribui pelo peso atual (preserve fallback)", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 50 }), // 5000
      pos({ ticker: "B", assetClass: "FII_PAPEL", quantity: 50, avgPrice: 100 }),         // 5000
    ];
    // 50/50, target balanced 50/50 → sem deficit positivo
    const plan = planContribution(positions, macro, 1000, "balanced");
    const a = plan.byClass.find((c) => c.assetClass === "ACAO_BR_DIVIDENDO");
    const b = plan.byClass.find((c) => c.assetClass === "FII_PAPEL");
    expect(a?.suggestedR$).toBeCloseTo(500, 1);
    expect(b?.suggestedR$).toBeCloseTo(500, 1);
  });

  it("preserve: distribui aporte proporcional aos pesos atuais", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 30 }), // 3000 (75%)
      pos({ ticker: "B", assetClass: "FII_PAPEL", quantity: 10, avgPrice: 100 }),         // 1000 (25%)
    ];
    const plan = planContribution(positions, macro, 1000, "preserve");
    const acao = plan.byClass.find((c) => c.assetClass === "ACAO_BR_DIVIDENDO");
    const fii = plan.byClass.find((c) => c.assetClass === "FII_PAPEL");
    expect(acao?.suggestedR$).toBeCloseTo(750, 1);
    expect(fii?.suggestedR$).toBeCloseTo(250, 1);
  });

  it("US asset valor é convertido por usdBrl pra ratear no BRL", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", currency: "BRL", quantity: 1, avgPrice: 1000 }),
      pos({ ticker: "B", assetClass: "STOCK_US", currency: "USD", quantity: 1, avgPrice: 100 }), // 100 * 5.20 = 520
    ];
    const plan = planContribution(positions, macro, 1000, "balanced");
    expect(plan.totalCurrentBRL).toBeCloseTo(1520, 1);
    // STOCK_US está em ~34% (520/1520), target 50% → underweight, recebe aporte maior
    const us = plan.byClass.find((c) => c.assetClass === "STOCK_US");
    expect(us?.suggestedR$).toBeGreaterThan(500);
  });

  it("aporte = 0 não quebra; sugestão fica em zero", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 30 }),
    ];
    const plan = planContribution(positions, macro, 0);
    expect(plan.byClass[0].suggestedR$).toBe(0);
    expect(plan.totalProjectedBRL).toBe(plan.totalCurrentBRL);
  });

  it("soma das sugestões fecha com o aporte (dentro de tolerância)", () => {
    const positions: AssetPosition[] = [
      pos({ ticker: "A", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 30 }),
      pos({ ticker: "B", assetClass: "FII_PAPEL", quantity: 10, avgPrice: 100 }),
      pos({ ticker: "C", assetClass: "ETF_BR", quantity: 5, avgPrice: 80 }),
    ];
    const plan = planContribution(positions, macro, 1500, "balanced");
    const sum = plan.byClass.reduce((s, c) => s + c.suggestedR$, 0);
    expect(sum).toBeCloseTo(1500, 1);
  });
});
