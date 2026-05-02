import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { TrendingUp } from "lucide-react";

describe("KpiCard", () => {
  it("renders label, value, and sub", () => {
    render(<KpiCard label="Patrimônio · 10a" value="R$ 641k" sub="Cenário Carteira" />);
    expect(screen.getByText("Patrimônio · 10a")).toBeInTheDocument();
    expect(screen.getByText("R$ 641k")).toBeInTheDocument();
    expect(screen.getByText("Cenário Carteira")).toBeInTheDocument();
  });

  it("renders delta with up arrow when dir=up", () => {
    render(<KpiCard label="X" value="Y" delta={{ value: "+10,8%", dir: "up" }} />);
    const delta = screen.getByText("+10,8%");
    expect(delta).toBeInTheDocument();
    const parent = delta.parentElement;
    expect(parent?.className).toMatch(/text-accent-green|text-green/);
  });

  it("renders delta with down arrow when dir=down", () => {
    render(<KpiCard label="X" value="Y" delta={{ value: "-2,1%", dir: "down" }} />);
    const parent = screen.getByText("-2,1%").parentElement;
    expect(parent?.className).toMatch(/text-accent-red|text-red/);
  });

  it("applies feature variant styling when feature=true", () => {
    const { container } = render(
      <KpiCard label="X" value="Y" feature />
    );
    const card = container.firstElementChild;
    expect(card?.getAttribute("style")).toMatch(/linear-gradient/);
  });

  it("renders with valueColor red", () => {
    render(<KpiCard label="X" value="-14,2%" valueColor="red" />);
    const value = screen.getByText("-14,2%");
    expect(value.className).toMatch(/text-accent-red/);
  });

  it("KpiSkeleton renders a card-shaped pulsing element", () => {
    const { container } = render(<KpiSkeleton />);
    const skeleton = container.firstElementChild;
    expect(skeleton?.className).toMatch(/animate-pulse/);
  });
});
