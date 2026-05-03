import { describe, it, expect } from "vitest";
import {
  LOSS_RATE_WARNING,
  riskStats,
  binDistribution,
  quantile,
  distributionPercentiles,
  lossRateInfo,
} from "@/lib/risco-derive";
import type { MonteCarloResultOut } from "@/lib/api-types";

const MC: MonteCarloResultOut = {
  label: "Test",
  color: "#27AE60",
  p10: [100, 200, 300],
  p50: [110, 220, 330],
  p90: [120, 240, 360],
  finalDistribution: [100, 200, 300, 400],
  maxDrawdowns: [0.10, 0.20, 0.30, 0.40],
};

describe("risco-derive — riskStats", () => {
  it("retorna finalP10/50/90 = último valor de cada array", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.finalP10).toBe(300);
    expect(s.finalP50).toBe(330);
    expect(s.finalP90).toBe(360);
  });

  it("probTarget = null quando target <= 0", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.probTarget).toBeNull();
  });

  it("probTarget calculado: target=250 → 2/4 finais >= 250 = 0.5", () => {
    const s = riskStats({ result: MC, target: 250, capitalInitial: 0 });
    expect(s.probTarget).toBe(0.5);
  });

  it("lossRate: capitalInitial=250 → 2/4 finais < 250 = 0.5", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 250 });
    expect(s.lossRate).toBe(0.5);
  });

  it("meanMaxDrawdown = média do array", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.meanMaxDrawdown).toBeCloseTo(0.25, 5);
  });
});

describe("risco-derive — binDistribution", () => {
  it("5 valores uniformes em 5 bins → 1 por bin", () => {
    const bins = binDistribution([1, 2, 3, 4, 5], 5);
    expect(bins).toHaveLength(5);
    bins.forEach((b) => expect(b.count).toBe(1));
  });

  it("array vazio → []", () => {
    expect(binDistribution([])).toEqual([]);
  });

  it("min === max → 1 bin com count = length", () => {
    const bins = binDistribution([5, 5, 5], 3);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
    expect(bins[0].start).toBe(5);
    expect(bins[0].end).toBe(5);
  });

  it("max sempre cai no último bin (closed interval right)", () => {
    const bins = binDistribution([0, 10], 5);
    expect(bins).toHaveLength(5);
    expect(bins[0].count).toBe(1);
    expect(bins[bins.length - 1].count).toBe(1);
  });
});

describe("risco-derive — quantile", () => {
  it("quantile mediano de [1..5] = 3", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("quantile 0.25 de [1..5] = 2 (linear interpolation)", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it("quantile 0 = primeiro elemento; quantile 1 = último", () => {
    expect(quantile([10, 20, 30], 0)).toBe(10);
    expect(quantile([10, 20, 30], 1)).toBe(30);
  });
});

describe("risco-derive — distributionPercentiles", () => {
  it("calcula p10/p50/p90 de [1..100]", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const p = distributionPercentiles(values);
    expect(p.p10).toBeCloseTo(10.9, 1);
    expect(p.p50).toBeCloseTo(50.5, 1);
    expect(p.p90).toBeCloseTo(90.1, 1);
  });
});

describe("risco-derive — lossRateInfo", () => {
  it("ambos < 5% → show=false, flagged vazio", () => {
    const info = lossRateInfo({ realEstateRate: 0.02, portfolioRate: 0.01 });
    expect(info.show).toBe(false);
    expect(info.flagged).toEqual([]);
  });

  it("Imóvel 8% → show=true, flagged inclui Imóvel", () => {
    const info = lossRateInfo({ realEstateRate: 0.08, portfolioRate: 0.02 });
    expect(info.show).toBe(true);
    expect(info.flagged).toEqual([{ label: "Imóvel", rate: 0.08 }]);
  });

  it("Carteira 12% → show=true, flagged inclui Carteira", () => {
    const info = lossRateInfo({ realEstateRate: 0.02, portfolioRate: 0.12 });
    expect(info.show).toBe(true);
    expect(info.flagged).toEqual([{ label: "Carteira", rate: 0.12 }]);
  });
});

describe("risco-derive — LOSS_RATE_WARNING", () => {
  it("threshold = 0.05 (5%)", () => {
    expect(LOSS_RATE_WARNING).toBe(0.05);
  });
});
