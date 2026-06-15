import { describe, it, expect } from "vitest";
import { equivalentCdbRate } from "@/lib/tax-compare";

describe("equivalentCdbRate", () => {
  it("h>=2 uses the 15% bracket", () => {
    // lci 10% a.a., h=10: r = (1 + ((1.1^10 −1)/0.85))^(1/10) − 1
    const r = equivalentCdbRate(0.10, 10);
    expect(r).toBeCloseTo(Math.pow(1 + (Math.pow(1.1, 10) - 1) / 0.85, 1 / 10) - 1, 10);
    expect(r).toBeGreaterThan(0.10);
  });
  it("h=1 uses 17,5%", () => {
    const r = equivalentCdbRate(0.10, 1);
    expect(r).toBeCloseTo(0.10 / 0.825, 6);
  });
});
