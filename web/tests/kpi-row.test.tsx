import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KpiRow } from "@/components/visao-geral/KpiRow";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut, SimulateMonteCarloOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];
const annualIncome = years.map((y) => y * 5_000);

const fakeSim: SimulateOut = {
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome, cumulativeIncome: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map((y) => y * 4_500), cumulativeIncome: years.map(() => 0) },
  sensitivity: [],
  taxComparison: [],
};

const fakeMc: SimulateMonteCarloOut = {
  portfolio: {
    label: "PF",
    color: "#0f0",
    p10: portfolioPatrimony.map((v) => v * 0.85),
    p50: portfolioPatrimony,
    p90: portfolioPatrimony.map((v) => v * 1.15),
    finalDistribution: Array.from({ length: 1000 }, (_, i) => i * 1000),
    maxDrawdowns: Array.from({ length: 1000 }, () => 0.15),
  },
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
  useMonteCarlo: () => ({ data: fakeMc, isLoading: false, error: null, refetch: vi.fn() }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("KpiRow nominal mode", () => {
  beforeEach(() => {
    useScenarioStore.setState({ displayMode: "nominal" });
  });

  it("renders 'Patrimônio projetado' KPI with nominal final value", () => {
    render(wrap(<KpiRow />));
    // portfolioPatrimony[10] = 588_000 → formatRsK = "R$ 588k"
    expect(screen.getByText("R$ 588k")).toBeInTheDocument();
  });

  it("'sub' shows 'Cenário Carteira (mediana)' in nominal mode", () => {
    render(wrap(<KpiRow />));
    expect(screen.getByText("Cenário Carteira (mediana)")).toBeInTheDocument();
  });
});

describe("KpiRow real mode", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 },
    });
  });

  it("'Patrimônio projetado' shows deflated final value in real mode", () => {
    render(wrap(<KpiRow />));
    // portfolioPatrimony[10] = 588_000, deflated by (1.1)^10 ≈ 226_699 → "R$ 227k"
    expect(screen.getByText("R$ 227k")).toBeInTheDocument();
  });

  it("sub contains 'nominal' and 'inflação consome' in real mode", () => {
    render(wrap(<KpiRow />));
    // sub should mention nominal value and how much inflation consumes
    expect(screen.getByText(/nominal.*inflação consome/i)).toBeInTheDocument();
  });

  it("'Renda mensal estimada' sub shows 'R$ de hoje' in real mode", () => {
    render(wrap(<KpiRow />));
    expect(screen.getByText(/R\$ de hoje/)).toBeInTheDocument();
  });
});

describe("KpiRow nominal mode – no R$ de hoje marker", () => {
  beforeEach(() => {
    useScenarioStore.setState({ displayMode: "nominal" });
  });

  it("does not show 'R$ de hoje' in nominal mode", () => {
    render(wrap(<KpiRow />));
    expect(screen.queryByText(/R\$ de hoje/)).toBeNull();
  });
});
