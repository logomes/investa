import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EvolutionCard } from "@/components/visao-geral/EvolutionCard";
import type { SimulateOut, SimulateMonteCarloOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];

const fakeSim: SimulateOut = {
  realEstate: { label: "RE", color: "#f00", years, patrimony: portfolioPatrimony.map((v) => v * 0.7), annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  sensitivity: [],
  taxComparison: [],
};

const fakeMc: SimulateMonteCarloOut = {
  realEstate: { label: "RE", color: "#f00", p10: portfolioPatrimony.map((v) => v * 0.6), p50: portfolioPatrimony.map((v) => v * 0.7), p90: portfolioPatrimony.map((v) => v * 0.8), finalDistribution: [], maxDrawdowns: [] },
  portfolio: { label: "PF", color: "#0f0", p10: portfolioPatrimony.map((v) => v * 0.85), p50: portfolioPatrimony, p90: portfolioPatrimony.map((v) => v * 1.15), finalDistribution: Array.from({ length: 1000 }, (_, i) => i), maxDrawdowns: [] },
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
  useMonteCarlo: () => ({ data: fakeMc, isLoading: false, error: null, refetch: vi.fn() }),
}));

// LineChart pulls SVG/canvas — we only care about the labels/legend prop wiring,
// so render a stub that surfaces xLabels and bands as data-attrs.
vi.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ xLabels, bands }: { xLabels: string[]; bands?: unknown[] }) => (
    <div data-testid="line-chart" data-xlabels={xLabels.join(",")} data-bands={bands ? bands.length : 0} />
  ),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("EvolutionCard timeline range", () => {
  it("default 10A mostra labels Y0..Y10 e bandas MC presentes", () => {
    render(wrap(<EvolutionCard />));
    const chart = screen.getByTestId("line-chart");
    expect(chart.dataset.xlabels).toBe("Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7,Y8,Y9,Y10");
    expect(chart.dataset.bands).toBe("1");
  });

  it("clicar em 1A troca pra labels mensais M0..M12 e oculta bandas MC", async () => {
    const user = userEvent.setup();
    render(wrap(<EvolutionCard />));
    await user.click(screen.getByRole("button", { name: "1A" }));

    const chart = screen.getByTestId("line-chart");
    expect(chart.dataset.xlabels).toBe(
      Array.from({ length: 13 }, (_, i) => `M${i}`).join(","),
    );
    expect(chart.dataset.bands).toBe("0");
  });
});
