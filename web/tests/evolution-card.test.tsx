import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EvolutionCard } from "@/components/visao-geral/EvolutionCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut, SimulateMonteCarloOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];

const fakeSim: SimulateOut = {
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  sensitivity: [],
  taxComparison: [],
};

const fakeMc: SimulateMonteCarloOut = {
  portfolio: { label: "PF", color: "#0f0", p10: portfolioPatrimony.map((v) => v * 0.85), p50: portfolioPatrimony, p90: portfolioPatrimony.map((v) => v * 1.15), finalDistribution: Array.from({ length: 1000 }, (_, i) => i), maxDrawdowns: [] },
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
  useMonteCarlo: () => ({ data: fakeMc, isLoading: false, error: null, refetch: vi.fn() }),
}));

// LineChart pulls SVG/canvas — we only care about the labels/legend prop wiring,
// so render a stub that surfaces xLabels, bands, and series values as data-attrs.
vi.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ xLabels, bands, series }: { xLabels: string[]; bands?: unknown[]; series: { name: string; values: number[] }[] }) => (
    <div data-testid="line-chart" data-xlabels={xLabels.join(",")} data-bands={bands ? bands.length : 0}>
      {series.map((s) => (
        <span key={s.name} data-testid="series-name" data-values={JSON.stringify(s.values)}>{s.name}</span>
      ))}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("EvolutionCard timeline range", () => {
  beforeEach(() => {
    useScenarioStore.setState({ displayMode: "nominal" });
  });

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

  it("não renderiza Imóvel — benchmark (BM) presente na legenda", () => {
    render(wrap(<EvolutionCard />));
    // The card renders a legend from `series` (portfolio + benchmark only).
    expect(screen.queryByText(/Imóvel/)).toBeNull();
    // benchmark fixture label "BM" must appear (in legend and/or chart stub)
    expect(screen.getAllByText("BM").length).toBeGreaterThan(0);
    // portfolio fixture label "PF" must appear (in legend and/or chart stub)
    expect(screen.getAllByText("PF").length).toBeGreaterThan(0);
  });
});

describe("EvolutionCard real mode", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 },
    });
  });

  it("portfolio series values are deflated by (1.1)^year in real mode", () => {
    render(wrap(<EvolutionCard />));
    const seriesEls = screen.getAllByTestId("series-name");
    const pfEl = seriesEls.find((el) => el.textContent === "PF");
    expect(pfEl).toBeDefined();
    const values: number[] = JSON.parse(pfEl!.dataset.values!);
    // year 0 stays the same (factor = 1), year 2 is divided by 1.21
    expect(values[0]).toBeCloseTo(portfolioPatrimony[0], 0);
    expect(values[2]).toBeCloseTo(portfolioPatrimony[2] / Math.pow(1.1, 2), 0);
  });

  it("bands count = 2 in real mode (MC band + inflação band)", () => {
    render(wrap(<EvolutionCard />));
    const chart = screen.getByTestId("line-chart");
    expect(chart.dataset.bands).toBe("2");
  });

  it("renders legend entry 'Inflação (perda de poder de compra)' in real mode", () => {
    render(wrap(<EvolutionCard />));
    expect(screen.getByText("Inflação (perda de poder de compra)")).toBeInTheDocument();
  });

  it("renders the 'R$ de hoje' badge in real mode", () => {
    render(wrap(<EvolutionCard />));
    expect(screen.getByText("R$ de hoje")).toBeInTheDocument();
  });
});
