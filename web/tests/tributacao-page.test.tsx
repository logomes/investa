import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TributacaoPageContent } from "@/components/tributacao/TributacaoPageContent";
import type { SimulateOut } from "@/lib/api-types";

const fakeSimOut: SimulateOut = {
  realEstate: {} as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [] as never,
  taxComparison: [
    {
      scenario: "Carteira Diversificada",
      grossIncome: 10_000,
      annualTax: 2_000,
      netIncome: 8_000,
      effectiveTaxBurden: 0.20,
    },
    {
      scenario: "CDI (líquido)",
      grossIncome: 12_000,
      annualTax: 2_100,
      netIncome: 9_900,
      effectiveTaxBurden: 0.175,
    },
  ],
};

let mockSimReturn: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useSimulate: () => mockSimReturn,
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("TributacaoPageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs Imposto Carteira + Imposto Benchmark", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/imposto carteira/i)).toBeInTheDocument();
    expect(screen.getByText(/imposto benchmark/i)).toBeInTheDocument();
    expect(screen.getByText(/diferença/i)).toBeInTheDocument();
  });

  it("não renderiza nenhuma referência a Imóvel", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
  });

  it("renderiza chart svg com pelo menos 2 grupos (1 por cenário)", () => {
    const { container } = render(wrap(<TributacaoPageContent />));
    const svg = container.querySelector("svg[aria-label='Comparativo tributário']");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("g").length).toBe(2);
  });

  it("renderiza tabela com 2 cenários", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getAllByText(/Carteira Diversificada/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CDI \(líquido\)/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza notas tributárias 2026 sem Aluguel (PF)", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/notas tributárias/i)).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.queryByText("Aluguel (PF)")).toBeNull();
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<TributacaoPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
