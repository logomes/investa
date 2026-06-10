import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthlyIncomeCard } from "@/components/visao-geral/MonthlyIncomeCard";
import type { SimulateOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];

const fakeSim: SimulateOut = {
  realEstate: { label: "RE", color: "#f00", years, patrimony: portfolioPatrimony.map((v) => v * 0.7), annualIncome: years.map(() => 0), cumulativeIncome: years.map(() => 0) },
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome: years.map((y) => y * 5_000), cumulativeIncome: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map((y) => y * 4_500), cumulativeIncome: years.map(() => 0) },
  sensitivity: [],
  taxComparison: [],
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
}));

// LineChart pulls SVG/canvas — stub it to surface series names for assertion.
vi.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ series }: { series: { name: string }[] }) => (
    <div data-testid="line-chart">
      {series.map((s) => (
        <span key={s.name} data-testid="series-name">{s.name}</span>
      ))}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("MonthlyIncomeCard", () => {
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

  it("não renderiza Imóvel — realEstate (RE) ausente do gráfico", () => {
    render(wrap(<MonthlyIncomeCard />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
    // realEstate fixture label "RE" must not appear as a rendered series name
    expect(screen.queryByText("RE")).toBeNull();
  });
});
