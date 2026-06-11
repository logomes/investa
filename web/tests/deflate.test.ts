import { describe, it, expect } from "vitest";
import { deflationFactor, deflateAt, deflateSeries } from "@/lib/deflate";

describe("deflate", () => {
  it("factor is (1+ipca)^-years", () => {
    expect(deflationFactor(0.10, 2)).toBeCloseTo(1 / 1.21);
    expect(deflationFactor(0.10, 0)).toBe(1);
  });

  it("ipca 0 is the identity", () => {
    expect(deflateAt(1_000, 0, 10)).toBe(1_000);
    expect(deflateSeries([100, 200, 300], 0)).toEqual([100, 200, 300]);
  });

  it("deflateSeries uses the index as the year", () => {
    const real = deflateSeries([1_000, 1_000, 1_000], 0.10);
    expect(real[0]).toBeCloseTo(1_000);
    expect(real[1]).toBeCloseTo(1_000 / 1.1);
    expect(real[2]).toBeCloseTo(1_000 / 1.21);
  });

  it("deflateAt matches the series convention", () => {
    expect(deflateAt(1_000, 0.10, 2)).toBeCloseTo(826.4462, 3);
  });
});
