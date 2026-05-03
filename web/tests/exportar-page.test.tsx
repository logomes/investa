import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExportarPageContent } from "@/components/exportar/ExportarPageContent";
import type { SimulateOut } from "@/lib/api-types";

const fakeSimOut: SimulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 30_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 1_000),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 500),
    debtBalance: null,
    internalPortfolio: null,
  },
  portfolio: {
    label: "Carteira diversificada",
    color: "#27AE60",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 25_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 1_500),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 750),
    debtBalance: null,
    internalPortfolio: null,
  },
  benchmark: {
    label: "Tesouro Selic líquido",
    color: "#5CC8FF",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 28_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 2_800),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 1_400),
    debtBalance: null,
    internalPortfolio: null,
  },
  sensitivity: [],
  taxComparison: [],
};

let mockSim: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { horizon: number } }) => T) =>
    selector({ scenario: { horizon: 10 } }),
}));

vi.mock("@/lib/api", () => ({
  useSimulate: () => mockSim,
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("ExportarPageContent", () => {
  beforeEach(() => {
    mockSim = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza header + botão Baixar CSV", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/Comparativo Imóvel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar csv/i })).toBeInTheDocument();
  });

  it("renderiza tabela com 33 linhas (3 cenários × 11 anos)", () => {
    const { container } = render(wrap(<ExportarPageContent />));
    const tbody = container.querySelector("tbody");
    expect(tbody).toBeTruthy();
    expect(tbody!.querySelectorAll("tr")).toHaveLength(33);
  });

  it("caption mostra 'X linhas' com contagem correta", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/33 linhas/i)).toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockSim = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<ExportarPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSim = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
