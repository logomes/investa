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
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: [230_000, 250_000, 270_000, 290_000, 310_000, 330_000, 350_000, 365_000, 378_000, 386_000, 393_000],
    annualIncome: Array(11).fill(10_000) as number[],
    cumulativeIncome: Array(11).fill(0) as number[],
    debtBalance: null,
    internalPortfolio: null,
  } as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [
    { parameter: "monthly_rent",            pessimistic: 320_000, optimistic: 470_000 },
    { parameter: "annual_appreciation",     pessimistic: 340_000, optimistic: 450_000 },
    { parameter: "vacancy_months_per_year", pessimistic: 410_000, optimistic: 380_000 },
    { parameter: "management_fee_pct",      pessimistic: 400_000, optimistic: 385_000 },
    { parameter: "iptu_rate",               pessimistic: 395_000, optimistic: 390_000 },
    { parameter: "income_tax_bracket",      pessimistic: 393_000, optimistic: 392_500 },
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
    expect(screen.getByText(/patrimônio imóvel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/393\.000/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza tornado svg com 6 linhas (uma por parâmetro)", () => {
    const { container } = render(wrap(<SensibilidadePageContent />));
    const svg = container.querySelector("svg[aria-label='Tornado de sensibilidade']");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("g").length).toBe(6);
  });

  it("renderiza tabela com labels traduzidos", () => {
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getAllByText(/Aluguel mensal/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IPTU/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Faixa IR/).length).toBeGreaterThanOrEqual(1);
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
