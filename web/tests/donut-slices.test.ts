import { describe, it, expect } from "vitest";
import { donutSlices, allocationSegments, ASSET_COLORS } from "@/lib/carteira-derive";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

const PF = DEFAULT_SCENARIO.portfolio;

describe("donutSlices", () => {
  it("retorna um slice por segmento não-zero", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(4);
  });

  it("filtra segmentos com weight = 0", () => {
    const segs = allocationSegments({
      ...PF,
      assets: PF.assets.map((a, i) => ({ ...a, weight: i === 0 ? 0 : a.weight })),
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(3);
  });

  it("1 segmento (weight=1) gera path com 2 arcos (split)", () => {
    const segs = allocationSegments({
      ...PF,
      assets: [{ name: "Solo", weight: 1.0, expectedYield: 0.1, capitalGain: 0, taxRate: 0, note: "", volatility: 0.1 }],
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(1);
    const arcCount = (slices[0].path.match(/A /g) ?? []).length;
    expect(arcCount).toBeGreaterThanOrEqual(2);
  });

  it("4 segmentos uniformes têm midAngle distribuídos a cada 90°", () => {
    const segs = allocationSegments({
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: 0.25 })),
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    for (let i = 1; i < slices.length; i++) {
      const diff = slices[i].midAngle - slices[i - 1].midAngle;
      expect(diff).toBeCloseTo((2 * Math.PI) / 4, 4);
    }
  });

  it("color do slice corresponde ao color do segmento", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    slices.forEach((s, i) => {
      expect(s.color).toBe(ASSET_COLORS[i]);
    });
  });

  it("path começa com M e termina com Z", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    slices.forEach((s) => {
      expect(s.path.startsWith("M ")).toBe(true);
      expect(s.path.trimEnd().endsWith("Z")).toBe(true);
    });
  });
});
