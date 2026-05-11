import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AtivosPageContent } from "@/components/ativos/AtivosPageContent";
import type { MacroOut } from "@/lib/api-types";
import { useAssetsStore } from "@/lib/ativos-store";

const fakeMacro: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

let mockMacro: { data: MacroOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useMacro: () => mockMacro,
  useSimulate: () => ({ data: undefined, isLoading: false, error: null }),
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("AtivosPageContent", () => {
  beforeEach(() => {
    mockMacro = { data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() };
    useAssetsStore.setState({ positions: [] });
  });

  it("empty state quando sem positions", async () => {
    render(wrap(<AtivosPageContent />));
    await waitFor(() => expect(screen.getByText(/nenhuma posição/i)).toBeInTheDocument());
  });

  it("renderiza KPIs + tabela + 2 cards de breakdown", async () => {
    useAssetsStore.setState({
      positions: [{
        id: "1",
        ticker: "HGCR11",
        assetClass: "FII",
        currency: "BRL",
        quantity: 100,
        avgPrice: 100,
        expectedYield: 0.13,
        capitalGain: 0,
        color: "#FFC857",
      }],
    });
    render(wrap(<AtivosPageContent />));
    await waitFor(() => expect(screen.getByText(/total alocado/i)).toBeInTheDocument());
    expect(screen.getByText(/dy blended/i)).toBeInTheDocument();
    expect(screen.getByText(/posições/i)).toBeInTheDocument();
    expect(screen.getByText(/por classe/i)).toBeInTheDocument();
    expect(screen.getByText(/por mercado/i)).toBeInTheDocument();
    expect(screen.getByText("HGCR11")).toBeInTheDocument();
  });

  it("macro loading → skeleton", () => {
    mockMacro = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<AtivosPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("macro error → ErrorCard", async () => {
    mockMacro = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<AtivosPageContent />));
    await waitFor(() => expect(screen.getByText(/falha/i)).toBeInTheDocument());
  });

  it("botão Adicionar visível no header da tabela", async () => {
    render(wrap(<AtivosPageContent />));
    await waitFor(() => expect(screen.getByRole("button", { name: /adicionar/i })).toBeInTheDocument());
  });
});
