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
      scenario: "Imóvel",
      grossIncome: 18_000,
      annualTax: 1_237.5,
      netIncome: 16_762.5,
      effectiveTaxBurden: 0.0688,
    },
    {
      scenario: "Carteira Diversificada",
      grossIncome: 27_945,
      annualTax: 414,
      netIncome: 27_531,
      effectiveTaxBurden: 0.0148,
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

  it("renderiza KPIs Imposto Imóvel + Imposto Carteira", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/imposto imóvel/i)).toBeInTheDocument();
    expect(screen.getByText(/imposto carteira/i)).toBeInTheDocument();
    expect(screen.getByText(/diferença/i)).toBeInTheDocument();
  });

  it("renderiza chart svg com pelo menos 2 grupos (1 por cenário)", () => {
    const { container } = render(wrap(<TributacaoPageContent />));
    const svg = container.querySelector("svg[aria-label='Comparativo tributário']");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("g").length).toBe(2);
  });

  it("renderiza tabela com 2 cenários", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getAllByText(/Imóvel/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Carteira Diversificada/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza notas tributárias 2026", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/notas tributárias/i)).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("Aluguel (PF)")).toBeInTheDocument();
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
