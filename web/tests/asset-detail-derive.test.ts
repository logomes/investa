import { describe, it, expect } from "vitest";
import { assetDetail } from "@/lib/asset-detail-derive";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { B3PaidProvent, B3ScheduledEvent, B3Trade } from "@/lib/b3-import";
import type { MacroOut } from "@/lib/api-types";

const NOW = new Date("2026-05-12T12:00:00Z");

const macro: MacroOut = {
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
    avgPrice: 30,
    expectedYield: 0.08,
    capitalGain: 0.03,
    color: "#5CC8FF",
    ...o,
    ticker,
  };
}

describe("assetDetail", () => {
  it("retorna position match case-insensitive", () => {
    const positions = [position({ ticker: "PETR4" })];
    const d = assetDetail("petr4", positions, [], [], [], macro, NOW);
    expect(d.position?.ticker).toBe("PETR4");
  });

  it("retorna null position quando ticker não está em positions", () => {
    const d = assetDetail("XYZW3", [], [], [], [], macro, NOW);
    expect(d.position).toBeNull();
    expect(d.marketValueBRL).toBe(0);
    expect(d.unrealized).toBeNull();
  });

  it("paid12m soma só pagamentos dos últimos 12 meses", () => {
    const paid: B3PaidProvent[] = [
      { ticker: "MXRF11", type: "Rendimento", paidDate: "2026-04-15", netValue: 100 }, // in
      { ticker: "MXRF11", type: "Rendimento", paidDate: "2025-06-01", netValue: 80 },  // in
      { ticker: "MXRF11", type: "Rendimento", paidDate: "2024-12-01", netValue: 500 }, // out (>12m)
    ];
    const d = assetDetail("MXRF11", [], [], paid, [], macro, NOW);
    expect(d.paid12m).toBe(180);
    expect(d.paidAllTime).toBe(680);
  });

  it("DY realizado = paid12m / marketValueBRL", () => {
    const pos = position({ ticker: "MXRF11", assetClass: "FII", quantity: 100, avgPrice: 10, currentPrice: 10 });
    const paid: B3PaidProvent[] = [{ ticker: "MXRF11", type: "Rendimento", paidDate: "2026-04-15", netValue: 130 }];
    const d = assetDetail("MXRF11", [pos], [], paid, [], macro, NOW);
    // market = 1000; paid12m = 130; dy = 13%
    expect(d.marketValueBRL).toBe(1000);
    expect(d.dyRealized12m).toBeCloseTo(0.13);
    expect(d.dyExpected).toBe(0.08);
  });

  it("trades são ordenados por data crescente", () => {
    const trades: B3Trade[] = [
      { ticker: "PETR4", side: "sell", quantity: 50, price: 50, date: "2026-03-01" },
      { ticker: "PETR4", side: "buy", quantity: 100, price: 30, date: "2025-01-15" },
    ];
    const d = assetDetail("PETR4", [], trades, [], [], macro, NOW);
    expect(d.trades).toHaveLength(2);
    expect(d.trades[0].date).toBe("2025-01-15");
    expect(d.trades[1].date).toBe("2026-03-01");
  });

  it("scheduled inclui só pagamentos futuros", () => {
    const sch: B3ScheduledEvent[] = [
      { ticker: "MXRF11", type: "RENDIMENTO", paymentDate: "2026-06-15", quantity: 100, unitPrice: 1, netValue: 100 },
      { ticker: "MXRF11", type: "RENDIMENTO", paymentDate: "2026-03-15", quantity: 100, unitPrice: 1, netValue: 90 }, // passou
    ];
    const d = assetDetail("MXRF11", [], [], [], sch, macro, NOW);
    expect(d.scheduled).toHaveLength(1);
    expect(d.scheduled[0].paymentDate).toBe("2026-06-15");
    expect(d.scheduledTotal).toBe(100);
  });

  it("ROI consolidado: market + paid - netInvested", () => {
    const pos = position({ ticker: "PETR4", quantity: 100, avgPrice: 30, currentPrice: 40 });
    const trades: B3Trade[] = [
      { ticker: "PETR4", side: "buy", quantity: 100, price: 30, date: "2025-01-01" }, // invested 3000
    ];
    const paid: B3PaidProvent[] = [
      { ticker: "PETR4", type: "Dividendo", paidDate: "2026-04-01", netValue: 200 },
    ];
    const d = assetDetail("PETR4", [pos], trades, paid, [], macro, NOW);
    // market = 4000; paid = 200; netInvested = 3000; return = 4000 + 200 - 3000 = 1200
    expect(d.totalInvested).toBe(3000);
    expect(d.totalWithdrawn).toBe(0);
    expect(d.netInvested).toBe(3000);
    expect(d.totalReturn).toBeCloseTo(1200);
    expect(d.roiTotal).toBeCloseTo(0.4); // 1200 / 3000
  });

  it("posição USD aplica macro.usdBrl no netInvested antes do ROI", () => {
    const pos = position({
      ticker: "AAPL", currency: "USD", assetClass: "STOCK_US",
      quantity: 10, avgPrice: 200, currentPrice: 200,
    });
    const trades: B3Trade[] = [
      { ticker: "AAPL", side: "buy", quantity: 10, price: 200, date: "2025-01-01" }, // invested $2000 nativo
    ];
    const d = assetDetail("AAPL", [pos], trades, [], [], macro, NOW);
    // market BRL = 10 × 200 × 5 = 10000
    // netInvested nativo = 2000, em BRL = 10000
    // return = 10000 - 10000 = 0; ROI = 0
    expect(d.marketValueBRL).toBe(10000);
    expect(d.totalReturn).toBeCloseTo(0);
    expect(d.roiTotal).toBeCloseTo(0);
  });

  it("ticker sem trades nem position retorna estrutura vazia (sem erro)", () => {
    const d = assetDetail("UNKNOWN", [], [], [], [], macro, NOW);
    expect(d.trades).toEqual([]);
    expect(d.paid).toEqual([]);
    expect(d.scheduled).toEqual([]);
    expect(d.totalInvested).toBe(0);
    expect(d.roiTotal).toBeNull();
  });
});
