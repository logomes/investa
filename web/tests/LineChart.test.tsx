import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

const series = [
  { name: "Carteira", color: "#27AE60", values: [230000, 250000, 271000] },
  { name: "Imóvel", color: "#C0392B", values: [230000, 240000, 250000] },
];

const bands = [
  { name: "Carteira p10-p90", color: "rgba(39,174,96,0.18)", lower: [220000, 240000, 260000], upper: [240000, 260000, 280000] },
];

describe("LineChart", () => {
  it("renders one path per series", () => {
    const { container } = render(<LineChart series={series} xLabels={["Y0", "Y1", "Y2"]} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(series.length);
  });

  it("renders X axis labels", () => {
    render(<LineChart series={series} xLabels={["Y0", "Y1", "Y2"]} />);
    expect(screen.getByText("Y0")).toBeInTheDocument();
    expect(screen.getByText("Y2")).toBeInTheDocument();
  });

  it("renders bands as filled paths when provided", () => {
    const { container } = render(<LineChart series={series} bands={bands} xLabels={["Y0", "Y1", "Y2"]} />);
    const filledPaths = Array.from(container.querySelectorAll("path")).filter(
      (p) => p.getAttribute("fill") && p.getAttribute("fill") !== "none"
    );
    expect(filledPaths.length).toBeGreaterThanOrEqual(1);
  });

  it("ChartSkeleton renders a pulsing rectangle of the given size", () => {
    const { container } = render(<ChartSkeleton width={780} height={300} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/animate-pulse/);
  });
});
