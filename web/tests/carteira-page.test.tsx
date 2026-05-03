import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CarteiraPageContent } from "@/components/carteira/CarteiraPageContent";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { MacroOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: typeof DEFAULT_SCENARIO }) => T) =>
    selector({ scenario: DEFAULT_SCENARIO }),
}));

const fakeMacro: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

let mockMacroReturn: { data: MacroOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: undefined, isLoading: false, error: null }),
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => mockMacroReturn,
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("CarteiraPageContent", () => {
  beforeEach(() => {
    mockMacroReturn = { data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs blended e barras de comparação", () => {
    render(wrap(<CarteiraPageContent />));
    expect(screen.getByText(/dy blended/i)).toBeInTheDocument();
    expect(screen.getByText(/retorno total/i)).toBeInTheDocument();
    expect(screen.getByText(/carteira blended/i)).toBeInTheDocument();
    expect(screen.getByText(/imóvel bruto/i)).toBeInTheDocument();
    expect(screen.getByText(/tesouro selic líquido/i)).toBeInTheDocument();
  });

  it("renderiza svg do donut", () => {
    const { container } = render(wrap(<CarteiraPageContent />));
    const svg = container.querySelector(`svg[aria-label="Alocação da carteira"]`);
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("path").length).toBeGreaterThanOrEqual(5);
  });

  it("renderiza tabela de detalhamento com 5 classes", () => {
    render(wrap(<CarteiraPageContent />));
    expect(screen.getAllByText("FIIs de Papel").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tesouro IPCA+ / LCI").length).toBeGreaterThanOrEqual(1);
  });

  it("loading → renderiza skeleton", () => {
    mockMacroReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<CarteiraPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockMacroReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<CarteiraPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
