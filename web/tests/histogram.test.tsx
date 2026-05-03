import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Histogram } from "@/components/risco/Histogram";

const VALUES = Array.from({ length: 100 }, (_, i) => 100_000 + i * 1_000);

describe("Histogram", () => {
  it("renderiza svg com pelo menos 30 elementos rect (bins)", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("rect").length).toBeGreaterThanOrEqual(30);
  });

  it("renderiza 3 textos com p10/p50/p90", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("p10");
    expect(texts).toContain("p50");
    expect(texts).toContain("p90");
  });

  it("quando target > 0 renderiza linha 'meta' adicional", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
        target={160_000}
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("meta");
  });
});
