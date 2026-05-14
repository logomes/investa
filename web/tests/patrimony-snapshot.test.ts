import { describe, it, expect } from "vitest";
import {
  computeSnapshot,
  assetMarketValueBRL,
  filterSnapshotsByRange,
  type PatrimonySnapshot,
} from "@/lib/patrimony-snapshot";
import { rfCurrentValue } from "@/lib/fi-derive";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { FixedIncomePosition } from "@/lib/fi-schema";
import type { MacroOut } from "@/lib/api-types";

const macro: MacroOut = {
  selic: 0.12, cdi: 0.12, ipca: 0.04, usdBrl: 5,
  isStale: false, sourceLabel: "test",
};

const TODAY = new Date("2026-05-11T12:00:00Z");

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

function rfPosition(o: Partial<FixedIncomePosition> & { id: string }): FixedIncomePosition {
  return {
    name: "CDB Banco X",
    initialAmount: 10_000,
    purchaseDate: "2024-05-11",
    indexer: "cdi",
    rate: 1.0,
    maturityDate: "2027-05-11",
    isTaxExempt: false,
    color: "#3498DB",
    ...o,
  };
}

describe("assetMarketValueBRL", () => {
  it("usa currentPrice quando disponível", () => {
    const p = position({ ticker: "PETR4", quantity: 100, avgPrice: 30, currentPrice: 50 });
    expect(assetMarketValueBRL(p, macro)).toBe(5000); // 100 × 50
  });

  it("cai pra avgPrice quando sem currentPrice", () => {
    const p = position({ ticker: "PETR4", quantity: 100, avgPrice: 30 });
    expect(assetMarketValueBRL(p, macro)).toBe(3000); // 100 × 30
  });

  it("converte USD para BRL via macro.usdBrl", () => {
    const p = position({ ticker: "AAPL", currency: "USD", quantity: 10, avgPrice: 200, assetClass: "STOCK_US" });
    expect(assetMarketValueBRL(p, macro)).toBe(10_000); // 10 × 200 × 5
  });
});

describe("rfCurrentValue", () => {
  it("CDB pós-CDI: compõe initialAmount × (1 + CDI × rate)^years", () => {
    // CDI 12% × rate 1.0 = 12% efetivo; 2 anos: 10.000 × 1.12^2 = 12544
    const p = rfPosition({ id: "1", purchaseDate: "2024-05-11", indexer: "cdi", rate: 1.0 });
    const v = rfCurrentValue(p, macro, TODAY);
    expect(v).toBeCloseTo(12544, 0);
  });

  it("prefixado: usa rate direta como taxa anual", () => {
    // 10% prefixado, 1 ano: 10.000 × 1.10 = 11.000
    const p = rfPosition({ id: "1", purchaseDate: "2025-05-11", indexer: "prefixado", rate: 0.10 });
    const v = rfCurrentValue(p, macro, TODAY);
    expect(v).toBeCloseTo(11_000, 0);
  });

  it("0 dias holding: valor == initialAmount", () => {
    const p = rfPosition({ id: "1", purchaseDate: TODAY.toISOString().slice(0, 10) });
    const v = rfCurrentValue(p, macro, TODAY);
    expect(v).toBeCloseTo(10_000, 0);
  });
});

describe("computeSnapshot", () => {
  it("soma RV (M2M) + RF (M2M) com contagens", () => {
    const pos = [
      position({ ticker: "PETR4", quantity: 100, avgPrice: 30, currentPrice: 50 }), // 5000
      position({ ticker: "VALE3", quantity: 50, avgPrice: 80, currentPrice: 100 }),   // 5000
    ];
    const rf = [
      rfPosition({ id: "1", purchaseDate: "2025-05-11", indexer: "prefixado", rate: 0.10, initialAmount: 10_000 }), // ~11.000
    ];
    const s = computeSnapshot(pos, rf, macro, TODAY);
    expect(s.rendaVariavel).toBeCloseTo(10_000, 0);
    expect(s.rendaFixa).toBeCloseTo(11_000, 0);
    expect(s.totalBRL).toBeCloseTo(21_000, 0);
    expect(s.positionsCount).toBe(2);
    expect(s.rfCount).toBe(1);
    expect(s.date).toBe("2026-05-11");
  });

  it("zero positions: total = 0", () => {
    const s = computeSnapshot([], [], macro, TODAY);
    expect(s.totalBRL).toBe(0);
    expect(s.positionsCount).toBe(0);
    expect(s.rfCount).toBe(0);
  });
});

describe("filterSnapshotsByRange", () => {
  const NOW = new Date("2026-05-15T12:00:00Z");

  function snap(date: string): PatrimonySnapshot {
    return { date, totalBRL: 0, rendaVariavel: 0, rendaFixa: 0, positionsCount: 0, rfCount: 0 };
  }

  const snapshots: PatrimonySnapshot[] = [
    snap("2015-01-01"),   // > 10 anos atrás
    snap("2020-05-15"),   // ~6 anos atrás
    snap("2022-05-15"),   // ~3 anos atrás
    snap("2024-05-15"),   // ~12 meses atrás (exato no cutoff)
    snap("2025-05-20"),   // ~12 meses atrás (dentro de 12m)
    snap("2026-04-15"),   // 1 mês atrás
    snap("2026-05-10"),   // 5 dias atrás
  ];

  it("range='all' retorna cópia do array completo", () => {
    const r = filterSnapshotsByRange(snapshots, "all", NOW);
    expect(r).toHaveLength(snapshots.length);
    expect(r).not.toBe(snapshots);
  });

  it("range='12m' pega só snapshots dos últimos 12 meses (cutoff inclusive)", () => {
    const r = filterSnapshotsByRange(snapshots, "12m", NOW);
    // cutoff = 2025-05-15 → 2025-05-20, 2026-04-15, 2026-05-10
    expect(r.map((s) => s.date)).toEqual(["2025-05-20", "2026-04-15", "2026-05-10"]);
  });

  it("range='24m' pega só snapshots dos últimos 24 meses", () => {
    const r = filterSnapshotsByRange(snapshots, "24m", NOW);
    // cutoff = 2024-05-15 (inclusive) → tudo após 2024-05-15 inclusive
    expect(r.map((s) => s.date)).toEqual(["2024-05-15", "2025-05-20", "2026-04-15", "2026-05-10"]);
  });

  it("range='5a' pega snapshots dos últimos 5 anos", () => {
    const r = filterSnapshotsByRange(snapshots, "5a", NOW);
    // cutoff = 2021-05-15 → 2022, 2024, 2025, 2026
    expect(r.map((s) => s.date)).toEqual(["2022-05-15", "2024-05-15", "2025-05-20", "2026-04-15", "2026-05-10"]);
  });

  it("range='10a' inclui o cutoff exato (2016-05-15) e tudo depois", () => {
    const r = filterSnapshotsByRange(snapshots, "10a", NOW);
    // cutoff = 2016-05-15 → 2020 em diante
    expect(r.map((s) => s.date)).toEqual([
      "2020-05-15",
      "2022-05-15",
      "2024-05-15",
      "2025-05-20",
      "2026-04-15",
      "2026-05-10",
    ]);
  });

  it("array vazio retorna vazio", () => {
    expect(filterSnapshotsByRange([], "12m", NOW)).toEqual([]);
    expect(filterSnapshotsByRange([], "all", NOW)).toEqual([]);
  });

  it("não mutate input", () => {
    const input = [snap("2025-01-01"), snap("2026-01-01")];
    const before = JSON.stringify(input);
    filterSnapshotsByRange(input, "12m", NOW);
    expect(JSON.stringify(input)).toBe(before);
  });
});
