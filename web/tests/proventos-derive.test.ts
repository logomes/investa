import { describe, it, expect } from "vitest";
import {
  proventosKpis,
  proventosMonthly,
  proventosByTicker,
} from "@/lib/proventos-derive";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { B3PaidProvent, B3ScheduledEvent } from "@/lib/b3-import";
import type { MacroOut } from "@/lib/api-types";

const NOW = new Date("2026-05-11T12:00:00Z");

const macro: MacroOut = {
  selic: 0.12, cdi: 0.12, ipca: 0.04, usdBrl: 5,
  isStale: false, sourceLabel: "test",
};

const position = (overrides: Partial<AssetPosition> & { ticker: string }): AssetPosition => {
  const { ticker } = overrides;
  return {
    id: ticker,
    assetClass: "FII_PAPEL",
    currency: "BRL",
    quantity: 100,
    avgPrice: 100,
    expectedYield: 0.12,
    capitalGain: 0,
    color: "#FFC857",
    ...overrides,
    ticker,
  };
};

const paidProvent = (overrides: Partial<B3PaidProvent> & { ticker: string; paidDate: string }): B3PaidProvent => ({
  type: "Rendimento",
  netValue: 120,
  ...overrides,
});

const scheduled = (overrides: Partial<B3ScheduledEvent> & { ticker: string; paymentDate: string }): B3ScheduledEvent => ({
  type: "RENDIMENTO",
  quantity: 100,
  unitPrice: 1.2,
  netValue: 120,
  ...overrides,
});

describe("proventosKpis", () => {
  it("paid12m soma só os pagamentos dos últimos 12 meses", () => {
    const paid = [
      paidProvent({ ticker: "HGCR11", paidDate: "2026-05-01", netValue: 100 }),  // dentro
      paidProvent({ ticker: "HGCR11", paidDate: "2025-06-01", netValue: 200 }),  // dentro (11m atrás)
      paidProvent({ ticker: "HGCR11", paidDate: "2024-12-01", netValue: 500 }),  // fora (>12m)
    ];
    const k = proventosKpis(paid, [], [], macro, NOW);
    expect(k.paid12m).toBe(300);
  });

  it("scheduledNext soma só os agendados futuros", () => {
    const sch = [
      scheduled({ ticker: "MXRF11", paymentDate: "2026-06-15", netValue: 80 }),
      scheduled({ ticker: "PETR4", paymentDate: "2026-04-01", netValue: 50 }),  // passou (não conta)
    ];
    const k = proventosKpis([], sch, [], macro, NOW);
    expect(k.scheduledNext).toBe(80);
  });

  it("dyRealized = paid12m / patrimônio total", () => {
    const positions = [
      position({ ticker: "HGCR11", quantity: 100, avgPrice: 100 }), // 10.000
      position({ ticker: "MXRF11", quantity: 50, avgPrice: 200 }),  // 10.000
    ];
    const paid = [
      paidProvent({ ticker: "HGCR11", paidDate: "2026-04-15", netValue: 1200 }),
      paidProvent({ ticker: "MXRF11", paidDate: "2026-04-20", netValue: 800 }),
    ];
    const k = proventosKpis(paid, [], positions, macro, NOW);
    // 2000 / 20000 = 10%
    expect(k.dyRealized).toBeCloseTo(0.1);
  });

  it("dyExpectedBlended pondera expectedYield pelo valor BRL", () => {
    const positions = [
      position({ ticker: "A", quantity: 100, avgPrice: 100, expectedYield: 0.12 }), // 10.000 @ 12%
      position({ ticker: "B", quantity: 100, avgPrice: 100, expectedYield: 0.06 }), // 10.000 @ 6%
    ];
    const k = proventosKpis([], [], positions, macro, NOW);
    // média ponderada = (0.12 + 0.06) / 2 = 0.09
    expect(k.dyExpectedBlended).toBeCloseTo(0.09);
  });

  it("nextPayment é o agendado mais próximo no futuro", () => {
    const sch = [
      scheduled({ ticker: "Z", paymentDate: "2026-07-01", netValue: 10 }),
      scheduled({ ticker: "A", paymentDate: "2026-05-15", netValue: 20 }),
    ];
    const k = proventosKpis([], sch, [], macro, NOW);
    expect(k.nextPayment).toEqual({ ticker: "A", date: "2026-05-15", netValue: 20 });
  });

  it("sem positions → dyRealized = 0", () => {
    const paid = [paidProvent({ ticker: "HGCR11", paidDate: "2026-04-15", netValue: 1200 })];
    const k = proventosKpis(paid, [], [], macro, NOW);
    expect(k.dyRealized).toBe(0);
  });
});

describe("proventosMonthly", () => {
  it("gera 24 meses passados + 3 futuros = 27 buckets", () => {
    const series = proventosMonthly([], [], 24, 3, NOW);
    expect(series).toHaveLength(27);
  });

  it("agrupa paid no mês correto e scheduled também", () => {
    const paid = [paidProvent({ ticker: "X", paidDate: "2026-04-15", netValue: 100 })];
    const sch = [scheduled({ ticker: "Y", paymentDate: "2026-06-20", netValue: 200 })];
    const series = proventosMonthly(paid, sch, 24, 3, NOW);
    const apr = series.find((s) => s.month === "2026-04");
    const jun = series.find((s) => s.month === "2026-06");
    expect(apr?.paid).toBe(100);
    expect(jun?.scheduled).toBe(200);
  });

  it("inclui o mês atual no passado", () => {
    const series = proventosMonthly([], [], 24, 3, NOW);
    expect(series[series.length - 4].month).toBe("2026-05"); // 27 buckets: last 3 are future, 4th-from-last is current
  });
});

describe("proventosByTicker", () => {
  it("uma linha por ticker com paid + scheduled agregados", () => {
    const positions = [position({ ticker: "HGCR11", quantity: 100, avgPrice: 100, expectedYield: 0.13 })];
    const paid = [
      paidProvent({ ticker: "HGCR11", paidDate: "2026-04-15", netValue: 50 }),
      paidProvent({ ticker: "HGCR11", paidDate: "2026-03-15", netValue: 50 }),
    ];
    const sch = [scheduled({ ticker: "HGCR11", paymentDate: "2026-06-15", netValue: 30 })];
    const rows = proventosByTicker(paid, sch, positions, macro, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].paid12m).toBe(100);
    expect(rows[0].scheduled).toBe(30);
    expect(rows[0].dyRealized).toBeCloseTo(0.01); // 100 / 10.000
    expect(rows[0].dyExpected).toBe(0.13);
  });

  it("tickers que não estão mais em positions aparecem com assetClass UNKNOWN", () => {
    const paid = [paidProvent({ ticker: "BAZA3", paidDate: "2026-04-15", netValue: 25 })];
    const rows = proventosByTicker(paid, [], [], macro, NOW);
    expect(rows[0].assetClass).toBe("UNKNOWN");
    expect(rows[0].dyRealized).toBeNull();
    expect(rows[0].dyExpected).toBeNull();
  });

  it("ordena desc por paid12m + scheduled", () => {
    const paid = [
      paidProvent({ ticker: "SMALL", paidDate: "2026-04-15", netValue: 10 }),
      paidProvent({ ticker: "BIG", paidDate: "2026-04-15", netValue: 500 }),
    ];
    const rows = proventosByTicker(paid, [], [], macro, NOW);
    expect(rows[0].ticker).toBe("BIG");
    expect(rows[1].ticker).toBe("SMALL");
  });
});
