import { describe, it, expect } from "vitest";
import {
  totalAllocated,
  weightedYield,
  weightedDuration,
  effectiveIrRate,
  byIndexer,
  byIrBracket,
  calendarByYear,
} from "@/lib/fi-derive";
import type { FixedIncomePosition } from "@/lib/fi-schema";
import type { MacroOut } from "@/lib/api-types";

const MACRO: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.048,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

function pos(over: Partial<FixedIncomePosition>): FixedIncomePosition {
  return {
    id: crypto.randomUUID(),
    name: "X",
    initialAmount: 1000,
    purchaseDate: "2025-01-01",
    indexer: "prefixado",
    rate: 0.10,
    maturityDate: null,
    isTaxExempt: false,
    color: "#3498DB",
    ...over,
  };
}

describe("fi-derive", () => {
  it("totalAllocated soma initialAmount de todas posições", () => {
    expect(totalAllocated([pos({ initialAmount: 1000 }), pos({ initialAmount: 2500 })])).toBe(3500);
  });

  it("weightedYield aplica IR regressivo", () => {
    // Single prefixado position, holding 0 days: IR=22.5%, yield líquido = 0.10 * 0.775 = 0.0775
    const today = new Date("2025-01-01");
    const positions = [pos({ purchaseDate: "2025-01-01", rate: 0.10, indexer: "prefixado" })];
    // Patched today via vi.useFakeTimers — but for this test, current date affects holding days.
    // Use a position with old purchaseDate to land in 15% bracket (>720 days):
    const old = [pos({ purchaseDate: "2020-01-01", rate: 0.10, indexer: "prefixado", initialAmount: 1000 })];
    const y = weightedYield(old, MACRO);
    // 0.10 * (1 - 0.15) = 0.085
    expect(y).toBeCloseTo(0.085, 5);
  });

  it("weightedDuration ignora positions sem maturity", () => {
    const today = new Date("2025-01-01");
    const positions = [
      pos({ initialAmount: 1000, maturityDate: "2030-01-01" }),    // 5 years
      pos({ initialAmount: 1000, maturityDate: null }),             // ignored
    ];
    // duration = (1000 * 5 + 1000 * 0) / 2000 = 2.5
    const d = weightedDuration(positions, today);
    expect(d).toBeCloseTo(2.5, 1);
  });

  it("effectiveIrRate mistura isento e taxado", () => {
    const today = new Date("2030-01-01");  // long enough for 15% bracket
    const positions = [
      pos({ initialAmount: 1000, isTaxExempt: true, purchaseDate: "2025-01-01" }),
      pos({ initialAmount: 1000, isTaxExempt: false, purchaseDate: "2020-01-01" }),
    ];
    // (1000 * 0 + 1000 * 0.15) / 2000 = 0.075
    expect(effectiveIrRate(positions, today)).toBeCloseTo(0.075, 5);
  });

  it("byIndexer agrega e ordena por total descendente", () => {
    const positions = [
      pos({ indexer: "cdi", initialAmount: 500 }),
      pos({ indexer: "ipca", initialAmount: 2000 }),
      pos({ indexer: "cdi", initialAmount: 1000 }),
    ];
    const grouped = byIndexer(positions);
    expect(grouped[0].indexer).toBe("ipca");
    expect(grouped[0].total).toBe(2000);
    expect(grouped[1].indexer).toBe("cdi");
    expect(grouped[1].total).toBe(1500);
  });

  it("byIrBracket classifica por holding days e isento", () => {
    const today = new Date("2025-12-31");
    const positions = [
      pos({ purchaseDate: "2025-12-25", initialAmount: 100 }),  // ≤180d
      pos({ purchaseDate: "2025-06-01", initialAmount: 200 }),  // 181-360d
      pos({ purchaseDate: "2024-06-01", initialAmount: 300 }),  // ~579d → 361-720d bracket
      pos({ purchaseDate: "2022-01-01", initialAmount: 400 }),  // >720d
      pos({ purchaseDate: "2025-01-01", initialAmount: 500, isTaxExempt: true }),
    ];
    const buckets = byIrBracket(positions, today);
    expect(buckets[0].total).toBe(100);  // Até 180d
    expect(buckets[1].total).toBe(200);  // 181-360d
    expect(buckets[2].total).toBe(300);  // 361-720d
    expect(buckets[3].total).toBe(400);  // >720d
    expect(buckets[4].total).toBe(500);  // isento
  });

  it("calendarByYear agrupa, ordena e adiciona sentinel para sem-maturity", () => {
    const positions = [
      pos({ name: "A", maturityDate: "2030-01-01", initialAmount: 100 }),
      pos({ name: "B", maturityDate: "2027-01-01", initialAmount: 200 }),
      pos({ name: "C", maturityDate: "2030-06-01", initialAmount: 300 }),
      pos({ name: "D", maturityDate: null, initialAmount: 400 }),
    ];
    const cal = calendarByYear(positions);
    expect(cal[0].year).toBe(2027);
    expect(cal[0].totalAtMaturity).toBe(200);
    expect(cal[1].year).toBe(2030);
    expect(cal[1].totalAtMaturity).toBe(400);  // 100 + 300
    expect(cal[2].year).toBe(0);  // sentinel
    expect(cal[2].totalAtMaturity).toBe(400);
  });
});
