import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExportarPageContent } from "@/components/exportar/ExportarPageContent";
import type { SimulateOut } from "@/lib/api-types";

type MockStore = { scenario: { horizon: number; expectedInflation: number }; displayMode: "nominal" | "real" };

let mockStoreState: MockStore = {
  scenario: { horizon: 10, expectedInflation: 0.10 },
  displayMode: "nominal",
};

const fakeSimOut: SimulateOut = {
  portfolio: {
    label: "Carteira Diversificada",
    color: "#27AE60",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 25_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 1_500),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 750),
  },
  benchmark: {
    label: "CDI (líquido)",
    color: "#5CC8FF",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 28_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 2_800),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 1_400),
  },
  sensitivity: [],
  taxComparison: [],
};

let mockSim: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: MockStore) => T) => selector(mockStoreState),
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
    mockStoreState = { scenario: { horizon: 10, expectedInflation: 0.10 }, displayMode: "nominal" };
  });

  it("renderiza header + botão Baixar CSV", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/Comparativo Carteira/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar csv/i })).toBeInTheDocument();
  });

  it("renderiza tabela com 22 linhas (2 cenários × 11 anos)", () => {
    const { container } = render(wrap(<ExportarPageContent />));
    const tbody = container.querySelector("tbody");
    expect(tbody).toBeTruthy();
    expect(tbody!.querySelectorAll("tr")).toHaveLength(22);
  });

  it("caption mostra 'X linhas' com contagem correta", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/22 linhas/i)).toBeInTheDocument();
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

  it("modo real: exibe badge 'R$ de hoje' e deflaciona patrimônio do último ano", () => {
    // patrimony[10] = 230_000 + 10 * 25_000 = 480_000; deflated @10% for 10yr ≈ 185_061
    mockStoreState = { scenario: { horizon: 10, expectedInflation: 0.10 }, displayMode: "real" };
    render(wrap(<ExportarPageContent />));
    // Badge visible
    expect(screen.getByText(/R\$ de hoje/i)).toBeInTheDocument();
    // Deflated value: 480_000 / (1.10)^10 ≈ 185_060,78 → formatRs shows "185.061"
    expect(screen.getByText(/185\.06[01]/)).toBeInTheDocument();
  });
});
