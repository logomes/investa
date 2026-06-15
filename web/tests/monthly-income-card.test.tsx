import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthlyIncomeCard } from "@/components/visao-geral/MonthlyIncomeCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";
import { MOCK_TAX_PROJECTION } from "./fixtures";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];

const fakeSim: SimulateOut = {
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome: years.map((y) => y * 5_000), cumulativeIncome: years.map(() => 0), grossPatrimony: portfolioPatrimony, taxPaidCumulative: years.map(() => 0), exitTax: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map((y) => y * 4_500), cumulativeIncome: years.map(() => 0), grossPatrimony: portfolioPatrimony.map((v) => v * 1.1), taxPaidCumulative: years.map(() => 0), exitTax: years.map(() => 0) },
  sensitivity: [],
  taxProjection: MOCK_TAX_PROJECTION,
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
}));

// LineChart pulls SVG/canvas — stub it to surface series names and values for assertion.
vi.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ series }: { series: { name: string; values: number[] }[] }) => (
    <div data-testid="line-chart">
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

describe("MonthlyIncomeCard", () => {
  beforeEach(() => {
    useScenarioStore.setState({ displayMode: "nominal" });
  });

  it("renderiza as séries portfolio e benchmark com os labels corretos", () => {
    render(wrap(<MonthlyIncomeCard />));
    // portfolio fixture label "PF" must appear as a series name
    expect(screen.getByText("PF")).toBeInTheDocument();
    // benchmark fixture label "BM" must appear as a series name
    expect(screen.getByText("BM")).toBeInTheDocument();
  });

  it("exibe o footer 'Carteira vs Benchmark · valor em R$/mês'", () => {
    render(wrap(<MonthlyIncomeCard />));
    expect(screen.getByText("Carteira vs Benchmark · valor em R$/mês")).toBeInTheDocument();
  });

  it("não renderiza Imóvel", () => {
    render(wrap(<MonthlyIncomeCard />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
  });
});

describe("MonthlyIncomeCard real mode", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 },
    });
  });

  it("year-index-2 income value is deflated by (1.1)^2 = 1.21 in real mode", () => {
    render(wrap(<MonthlyIncomeCard />));
    const pfEl = screen.getAllByTestId("series-name").find((el) => el.textContent === "PF");
    expect(pfEl).toBeDefined();
    const values: number[] = JSON.parse(pfEl!.dataset.values!);
    // annualIncome[2] = 2 * 5000 = 10000, deflated = 10000/1.21, monthly = /12
    const expectedMonthly = (2 * 5_000) / 1.21 / 12;
    expect(values[2]).toBeCloseTo(expectedMonthly, 2);
  });

  it("renders the 'R$ de hoje' badge in real mode", () => {
    render(wrap(<MonthlyIncomeCard />));
    expect(screen.getByText("R$ de hoje")).toBeInTheDocument();
  });
});
