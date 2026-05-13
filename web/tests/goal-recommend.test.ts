import { describe, it, expect } from "vitest";
import { recommend, goalProbability } from "@/lib/goal-recommend";

const BASE = {
  goal: 1_000_000,
  capital: 200_000,
  horizonYears: 10,
  currentMonthlyContribution: 1_000,
  contributionInflationIndexed: false,
  totalReturnAnnualNet: 0.08,
  projectedFinalPatrimony: 600_000,
  expectedInflation: 0.04,
};

describe("recommend", () => {
  it("already-met when capital >= goal", () => {
    const r = recommend({ ...BASE, capital: 1_500_000 });
    expect(r.state).toBe("already-met");
  });

  it("already-on-track when projectedFinal >= goal", () => {
    const r = recommend({ ...BASE, projectedFinalPatrimony: 1_100_000 });
    expect(r.state).toBe("already-on-track");
    if (r.state === "already-on-track") {
      expect(r.projectedFinal).toBe(1_100_000);
    }
  });

  it("below: classic case returns positive delta and suggested = current + delta", () => {
    const r = recommend(BASE);
    expect(r.state).toBe("below");
    if (r.state === "below") {
      expect(r.deltaMonthly).toBeGreaterThan(0);
      expect(r.suggestedMonthly).toBeCloseTo(BASE.currentMonthlyContribution + r.deltaMonthly, 5);
    }
  });

  it("below with current=0: suggested equals delta", () => {
    const r = recommend({ ...BASE, currentMonthlyContribution: 0 });
    expect(r.state).toBe("below");
    if (r.state === "below") {
      expect(r.suggestedMonthly).toBeCloseTo(r.deltaMonthly, 5);
    }
  });

  it("unreachable when suggested > 10x current contribution", () => {
    const r = recommend({ ...BASE, goal: 50_000_000, projectedFinalPatrimony: 600_000 });
    expect(r.state).toBe("unreachable");
  });

  it("unreachable via R$ 50k absolute cap when current=0", () => {
    const r = recommend({
      ...BASE,
      currentMonthlyContribution: 0,
      goal: 50_000_000,
      projectedFinalPatrimony: 200_000,
    });
    expect(r.state).toBe("unreachable");
  });

  it("IPCA-indexed: real-rate differs from nominal-rate suggestion", () => {
    const nominal = recommend({ ...BASE, contributionInflationIndexed: false });
    const indexed = recommend({ ...BASE, contributionInflationIndexed: true });
    expect(nominal.state).toBe("below");
    expect(indexed.state).toBe("below");
    if (nominal.state === "below" && indexed.state === "below") {
      expect(indexed.suggestedMonthly).toBeGreaterThan(nominal.suggestedMonthly);
    }
  });

  it("zero yield falls back to linear annuity", () => {
    const r = recommend({ ...BASE, totalReturnAnnualNet: 0 });
    expect(r.state).toBe("below");
    if (r.state === "below") {
      const expectedDelta = 400_000 / 120;
      expect(r.deltaMonthly).toBeCloseTo(expectedDelta, 2);
    }
  });

  it("horizon=0 with gap > 0 returns unreachable", () => {
    const r = recommend({ ...BASE, horizonYears: 0 });
    expect(r.state).toBe("unreachable");
  });

  it("horizon=0 with no gap returns already-on-track", () => {
    const r = recommend({ ...BASE, horizonYears: 0, projectedFinalPatrimony: 1_000_000 });
    expect(r.state).toBe("already-on-track");
  });
});

describe("goalProbability", () => {
  it("returns 0 for empty distribution", () => {
    expect(goalProbability([], 1_000_000)).toBe(0);
  });

  it("returns fraction of values >= goal", () => {
    const dist = [500_000, 800_000, 1_000_000, 1_200_000, 1_500_000];
    expect(goalProbability(dist, 1_000_000)).toBeCloseTo(0.6);
  });

  it("returns 1 when all values clear the goal", () => {
    expect(goalProbability([1, 2, 3], 0)).toBe(1);
  });

  it("returns 0 when no value clears the goal", () => {
    expect(goalProbability([1, 2, 3], 100)).toBe(0);
  });
});
