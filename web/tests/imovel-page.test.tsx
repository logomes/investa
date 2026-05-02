import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImovelPageContent } from "@/components/imovel/ImovelPageContent";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: typeof DEFAULT_SCENARIO }) => T) =>
    selector({ scenario: DEFAULT_SCENARIO }),
}));

const fakeSimOut = (financed: boolean): SimulateOut => ({
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5],
    patrimony: [230_000, 245_000, 260_000, 275_000, 290_000, 305_000],
    annualIncome: [9_662, 10_000, 10_500, 11_000, 11_500, 12_000],
    cumulativeIncome: [0, 9_662, 19_662, 30_162, 41_162, 52_662],
    debtBalance: financed ? [184_000, 178_000, 171_500, 164_500, 157_000, 149_000] : null,
    internalPortfolio: financed ? [0, 200, 500, 700, 1_000, 1_300] : null,
  } as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [] as never,
  taxComparison: [] as never,
});

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

describe("ImovelPageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut(false), isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs com defaults (Yield Bruto / Líquido visíveis)", () => {
    render(wrap(<ImovelPageContent />));
    expect(screen.getByText(/yield bruto/i)).toBeInTheDocument();
    expect(screen.getByText(/yield líquido/i)).toBeInTheDocument();
  });

  it("financing == null → FinancingCard não monta", () => {
    render(wrap(<ImovelPageContent />));
    expect(screen.queryByText(/parcela inicial/i)).not.toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<ImovelPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<ImovelPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
