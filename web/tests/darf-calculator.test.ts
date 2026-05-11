import { describe, it, expect } from "vitest";
import { computeMonthlyDarf, tickerToClassMap } from "@/lib/darf-calculator";
import type { B3Trade } from "@/lib/b3-import";
import type { AssetPosition, AssetClass } from "@/lib/ativos-schema";

function trade(t: Partial<B3Trade> & { ticker: string; date: string; side: "buy" | "sell"; quantity: number; price: number }): B3Trade {
  return { ticker: t.ticker, side: t.side, quantity: t.quantity, price: t.price, date: t.date };
}

const lookupAcao = () => "ACAO_BR_DIVIDENDO" as AssetClass;
const lookupFii = () => "FII" as AssetClass;
const lookupBdr = () => "BDR" as AssetClass;

describe("computeMonthlyDarf", () => {
  it("ações com vendas <= R$ 20k no mês → isento, sem DARF", () => {
    const trades = [
      trade({ ticker: "PETR4", date: "2026-01-10", side: "buy", quantity: 100, price: 30 }),
      trade({ ticker: "PETR4", date: "2026-02-10", side: "sell", quantity: 100, price: 50 }), // 5000 vendas, lucro 2000
    ];
    const darfs = computeMonthlyDarf(trades, lookupAcao);
    expect(darfs).toHaveLength(1);
    const feb = darfs[0];
    expect(feb.month).toBe("2026-02");
    expect(feb.buckets[0].isExempt).toBe(true);
    expect(feb.buckets[0].darfBRL).toBe(0);
    expect(feb.totalDarfBRL).toBe(0);
  });

  it("ações com vendas > R$ 20k → 15% sobre lucro", () => {
    const trades = [
      trade({ ticker: "PETR4", date: "2026-01-10", side: "buy", quantity: 1000, price: 30 }),
      trade({ ticker: "PETR4", date: "2026-02-10", side: "sell", quantity: 1000, price: 50 }), // 50k vendas, lucro 20k
    ];
    const darfs = computeMonthlyDarf(trades, lookupAcao);
    const feb = darfs[0];
    expect(feb.buckets[0].isExempt).toBe(false);
    expect(feb.buckets[0].realizedGain).toBeCloseTo(20000, 2);
    expect(feb.buckets[0].darfBRL).toBeCloseTo(3000, 2); // 20000 × 0.15
  });

  it("FIIs: sempre tributa 20%, sem isenção R$ 20k", () => {
    const trades = [
      trade({ ticker: "HGCR11", date: "2026-01-10", side: "buy", quantity: 50, price: 100 }),
      trade({ ticker: "HGCR11", date: "2026-02-10", side: "sell", quantity: 50, price: 110 }), // vendas 5500, lucro 500
    ];
    const darfs = computeMonthlyDarf(trades, lookupFii);
    const feb = darfs[0];
    expect(feb.buckets[0].isExempt).toBe(false); // FII nunca isento
    expect(feb.buckets[0].realizedGain).toBeCloseTo(500, 2);
    expect(feb.buckets[0].darfBRL).toBeCloseTo(100, 2); // 500 × 0.20
  });

  it("prejuízo no mês A compensa lucro no mês B (mesmo bucket)", () => {
    const trades = [
      // Janeiro: prejuízo 1000 (vendeu por menos do que comprou)
      trade({ ticker: "PETR4", date: "2025-12-01", side: "buy", quantity: 1000, price: 50 }),
      trade({ ticker: "PETR4", date: "2026-01-15", side: "sell", quantity: 1000, price: 49 }), // 49k vendas, prejuízo 1000
      // Fevereiro: lucro 5000 acima de 20k vendas
      trade({ ticker: "VALE3", date: "2025-11-01", side: "buy", quantity: 1000, price: 80 }),
      trade({ ticker: "VALE3", date: "2026-02-15", side: "sell", quantity: 1000, price: 85 }), // 85k vendas, lucro 5000
    ];
    const darfs = computeMonthlyDarf(trades, lookupAcao);
    expect(darfs).toHaveLength(2);
    const jan = darfs[0];
    const feb = darfs[1];
    expect(jan.buckets[0].realizedGain).toBeCloseTo(-1000, 2);
    expect(jan.buckets[0].accumulatedLossOut).toBeCloseTo(1000, 2);
    expect(jan.buckets[0].darfBRL).toBe(0);
    expect(feb.buckets[0].accumulatedLossIn).toBeCloseTo(1000, 2);
    expect(feb.buckets[0].taxableGain).toBeCloseTo(4000, 2); // 5000 - 1000
    expect(feb.buckets[0].darfBRL).toBeCloseTo(600, 2); // 4000 × 0.15
  });

  it("FII e ações têm pools de prejuízo SEPARADOS", () => {
    // Prejuízo em FII não compensa lucro em ações.
    const trades = [
      // FII prejuízo 1000
      trade({ ticker: "HGCR11", date: "2025-12-01", side: "buy", quantity: 50, price: 100 }),
      trade({ ticker: "HGCR11", date: "2026-01-15", side: "sell", quantity: 50, price: 80 }),
    ];
    // mock per-ticker class
    const lookup = (t: string): AssetClass => t === "HGCR11" ? "FII" : "ACAO_BR_DIVIDENDO";
    const trades2 = [
      ...trades,
      // Ação lucro 5000 acima de 20k vendas (sem prejuízo a compensar do bucket ações)
      trade({ ticker: "PETR4", date: "2025-11-01", side: "buy", quantity: 1000, price: 30 }),
      trade({ ticker: "PETR4", date: "2026-02-15", side: "sell", quantity: 1000, price: 35 }),
    ];
    const darfs = computeMonthlyDarf(trades2, lookup);
    const feb = darfs.find((d) => d.month === "2026-02")!;
    const acao = feb.buckets.find((b) => b.bucket === "acoes_isenta")!;
    expect(acao.accumulatedLossIn).toBe(0); // prejuízo de FII não vem
    expect(acao.darfBRL).toBeCloseTo(750, 2); // 5000 × 0.15
  });

  it("BDR é tributado sempre (não tem isenção R$ 20k)", () => {
    const trades = [
      trade({ ticker: "ROXO34", date: "2026-01-10", side: "buy", quantity: 100, price: 10 }),
      trade({ ticker: "ROXO34", date: "2026-02-10", side: "sell", quantity: 100, price: 12 }), // 1200 vendas (< 20k), lucro 200
    ];
    const darfs = computeMonthlyDarf(trades, lookupBdr);
    const feb = darfs[0];
    expect(feb.buckets[0].isExempt).toBe(false); // BDR sempre tributado
    expect(feb.buckets[0].darfBRL).toBeCloseTo(30, 2); // 200 × 0.15
  });

  it("avgPrice fiscal: dois buys + sell parcial preserva avg ponderado", () => {
    const trades = [
      trade({ ticker: "PETR4", date: "2026-01-10", side: "buy", quantity: 100, price: 30 }),  // avg=30, qty=100
      trade({ ticker: "PETR4", date: "2026-02-10", side: "buy", quantity: 100, price: 50 }),  // avg=40, qty=200
      trade({ ticker: "PETR4", date: "2026-03-15", side: "sell", quantity: 1000, price: 60 }), // não tem 1000, mas vamos simular venda parcial real:
    ];
    // ajustando pra ter qty suficiente:
    const trades2 = [
      trade({ ticker: "PETR4", date: "2026-01-10", side: "buy", quantity: 1000, price: 30 }),
      trade({ ticker: "PETR4", date: "2026-02-10", side: "buy", quantity: 1000, price: 50 }),
      trade({ ticker: "PETR4", date: "2026-03-15", side: "sell", quantity: 500, price: 60 }), // vendas 30k > 20k, avg=40, lucro = (60-40)*500 = 10000
    ];
    const darfs = computeMonthlyDarf(trades2, lookupAcao);
    const mar = darfs.find((d) => d.month === "2026-03")!;
    expect(mar.buckets[0].realizedGain).toBeCloseTo(10000, 2);
    expect(mar.buckets[0].darfBRL).toBeCloseTo(1500, 2); // 10000 × 0.15
  });

  it("trades fora de ordem cronológica são re-ordenados antes do cálculo", () => {
    const trades = [
      trade({ ticker: "PETR4", date: "2026-03-15", side: "sell", quantity: 1000, price: 50 }),
      trade({ ticker: "PETR4", date: "2026-01-10", side: "buy", quantity: 1000, price: 30 }),
    ];
    const darfs = computeMonthlyDarf(trades, lookupAcao);
    expect(darfs[0].buckets[0].realizedGain).toBeCloseTo(20000, 2);
  });

  it("ticker sem classificação (não está em positions) é ignorado", () => {
    const trades = [
      trade({ ticker: "XYZW3", date: "2026-01-10", side: "buy", quantity: 100, price: 30 }),
      trade({ ticker: "XYZW3", date: "2026-02-10", side: "sell", quantity: 100, price: 50 }),
    ];
    const darfs = computeMonthlyDarf(trades, () => null);
    expect(darfs).toEqual([]);
  });
});

describe("tickerToClassMap", () => {
  it("retorna a classe da posição (case-insensitive)", () => {
    const positions: AssetPosition[] = [{
      id: "1", ticker: "PETR4", assetClass: "ACAO_BR_DIVIDENDO",
      currency: "BRL", quantity: 100, avgPrice: 30,
      expectedYield: 0.08, capitalGain: 0.03, color: "#fff",
    }];
    const lookup = tickerToClassMap(positions);
    expect(lookup("petr4")).toBe("ACAO_BR_DIVIDENDO");
    expect(lookup("PETR4")).toBe("ACAO_BR_DIVIDENDO");
  });

  it("ticker fora das posições cai pra inferAssetClass (suporta sells totais)", () => {
    // Sells de ticker que foi vendido por completo (e não está mais em
    // positions) ainda precisam ser classificados pra DARF — caso
    // contrário a venda some do cálculo. Fallback: pattern do ticker.
    const lookup = tickerToClassMap([]);
    expect(lookup("BAZA3")).toBe("ACAO_BR_DIVIDENDO"); // *3 = ON
    expect(lookup("ROXO34")).toBe("BDR");              // *34 = BDR
    expect(lookup("HGCR11")).toBe("FII");        // *11 sem whitelist = FII
  });
});
