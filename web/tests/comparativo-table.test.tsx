import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComparativoTable } from "@/components/visao-geral/ComparativoTable";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];

const fakeSim: SimulateOut = {
  portfolio: { label: "PF", color: "#0f0", years, patrimony: portfolioPatrimony, annualIncome: years.map((y) => y * 5_000), cumulativeIncome: years.map(() => 0) },
  benchmark: { label: "BM", color: "#00f", years, patrimony: portfolioPatrimony.map((v) => v * 1.1), annualIncome: years.map((y) => y * 4_500), cumulativeIncome: years.map(() => 0) },
  sensitivity: [],
  taxComparison: [],
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("ComparativoTable", () => {
  beforeEach(() => {
    useScenarioStore.setState({ displayMode: "nominal" });
  });

  it("exibe a linha da carteira (PF) e a linha do benchmark (BM) na tabela", () => {
    render(wrap(<ComparativoTable />));
    // Each row renders the series label as a pill badge
    expect(screen.getByText("PF")).toBeInTheDocument();
    expect(screen.getByText("BM")).toBeInTheDocument();
  });

  it("não renderiza Imóvel", () => {
    render(wrap(<ComparativoTable />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
  });
});

describe("ComparativoTable real mode", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 },
    });
  });

  it("final patrimony cell shows deflated value in real mode", () => {
    render(wrap(<ComparativoTable />));
    // portfolioPatrimony[10] = 588_000, deflated by (1.1)^10 ≈ 226_699 → formatRsK = "R$ 227k"
    const finalNominal = portfolioPatrimony[10];
    const finalReal = finalNominal / Math.pow(1.1, 10);
    const expectedK = Math.round(finalReal / 1_000);
    expect(screen.getByText(`R$ ${expectedK}k`)).toBeInTheDocument();
  });

  it("renders the 'R$ de hoje' badge in real mode", () => {
    render(wrap(<ComparativoTable />));
    expect(screen.getByText("R$ de hoje")).toBeInTheDocument();
  });
});
