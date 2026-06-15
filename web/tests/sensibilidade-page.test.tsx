import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SensibilidadePageContent } from "@/components/sensibilidade/SensibilidadePageContent";
import type { SimulateOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { horizon: number } }) => T) =>
    selector({ scenario: { horizon: 10 } }),
}));

const fakeSimOut: SimulateOut = {
  portfolio: {
    label: "Carteira",
    color: "#1A73E8",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: [100_000, 130_000, 160_000, 195_000, 230_000, 270_000, 315_000, 365_000, 420_000, 470_000, 520_000],
    annualIncome: Array(11).fill(8_000) as number[],
    cumulativeIncome: Array(11).fill(0) as number[],
  },
  benchmark: {} as never,
  sensitivity: [
    { parameter: "Yield da carteira (±1,5pp)", pessimistic: 320_000, optimistic: 470_000 },
    { parameter: "Ganho de capital (±1,5pp)",  pessimistic: 340_000, optimistic: 450_000 },
    { parameter: "Aporte mensal (±25%)",       pessimistic: 410_000, optimistic: 380_000 },
    { parameter: "IR efetivo (±5pp)",          pessimistic: 400_000, optimistic: 385_000 },
  ],
  taxComparison: [] as never,
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

describe("SensibilidadePageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPI banner com base patrimony", () => {
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getByText(/patrimônio carteira/i)).toBeInTheDocument();
    expect(screen.getAllByText(/520\.000/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza tornado svg com 4 linhas (uma por parâmetro)", () => {
    const { container } = render(wrap(<SensibilidadePageContent />));
    const svg = container.querySelector("svg[aria-label='Tornado de sensibilidade']");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("g").length).toBe(4);
  });

  it("renderiza tabela com labels da carteira", () => {
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getAllByText(/Yield da carteira/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ganho de capital/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IR efetivo/).length).toBeGreaterThanOrEqual(1);
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<SensibilidadePageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
