import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RiscoPageContent } from "@/components/risco/RiscoPageContent";
import type { SimulateMonteCarloOut, SimulateOut } from "@/lib/api-types";

const fakeMcOut: SimulateMonteCarloOut = {
  portfolio: {
    label: "Carteira",
    color: "#27AE60",
    p10: [230_000, 250_000, 270_000],
    p50: [230_000, 270_000, 320_000],
    p90: [230_000, 290_000, 380_000],
    finalDistribution: Array.from({ length: 100 }, (_, i) => 250_000 + i * 1_800),
    maxDrawdowns: Array.from({ length: 100 }, () => 0.22),
  },
};

const fakeSimOut: SimulateOut = {
  portfolio: { years: [0, 1, 2] } as never,
  benchmark: {
    label: "CDI",
    color: "#F1C40F",
    years: [0, 1, 2],
    patrimony: [230_000, 250_000, 275_000],
    annualIncome: [],
    cumulativeIncome: [],
  },
  sensitivity: [] as never,
  taxComparison: [] as never,
};

type MockStore = {
  capital: number;
  targetPatrimony: number;
  nTrajectories: number;
  displayMode: "nominal" | "real";
  expectedInflation: number;
};

let mockMc: { data: SimulateMonteCarloOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
let mockSim: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
let mockStore: MockStore;

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(
    selector: (s: {
      scenario: { capital: number; expectedInflation: number };
      mc: { targetPatrimony: number; nTrajectories: number };
      displayMode: "nominal" | "real";
    }) => T,
  ) =>
    selector({
      scenario: { capital: mockStore.capital, expectedInflation: mockStore.expectedInflation },
      mc: { targetPatrimony: mockStore.targetPatrimony, nTrajectories: mockStore.nTrajectories },
      displayMode: mockStore.displayMode,
    }),
}));

vi.mock("@/lib/api", () => ({
  useMonteCarlo: () => mockMc,
  useSimulate: () => mockSim,
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("RiscoPageContent", () => {
  beforeEach(() => {
    mockMc = { data: fakeMcOut, isLoading: false, error: null, refetch: vi.fn() };
    mockSim = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
    mockStore = {
      capital: 230_000,
      targetPatrimony: 0,
      nTrajectories: 2_000,
      displayMode: "nominal",
      expectedInflation: 0.055,
    };
  });

  it("renderiza KPIs (Prob meta, p50, p10, drawdown)", () => {
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/probabilidade de bater meta/i)).toBeInTheDocument();
    expect(screen.getByText(/patrimônio mediano/i)).toBeInTheDocument();
    expect(screen.getByText(/pior cenário/i)).toBeInTheDocument();
    expect(screen.getByText(/drawdown médio/i)).toBeInTheDocument();
  });

  it("não renderiza referências a Imóvel nos KPIs", () => {
    render(wrap(<RiscoPageContent />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
  });

  it("sem target → KPI Prob meta mostra '—' + sub configure", () => {
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/configure meta/i)).toBeInTheDocument();
  });

  it("com target → KPI Prob meta mostra valor numérico", () => {
    mockStore = { ...mockStore, capital: 230_000, targetPatrimony: 350_000, nTrajectories: 2_000 };
    render(wrap(<RiscoPageContent />));
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("loss < 5% na carteira → LossRateBanner não monta", () => {
    mockStore = { ...mockStore, capital: 100_000 };
    render(wrap(<RiscoPageContent />));
    expect(screen.queryByText(/perda nominal abaixo/i)).not.toBeInTheDocument();
  });

  it("loss > 5% na carteira → LossRateBanner monta com texto e label da carteira", () => {
    // portfolio finalDistribution starts at 250k; with capital=300k, 28 of 100 values fall
    // below 300k (28% > 5% threshold) → banner must render
    mockStore = { ...mockStore, capital: 300_000 };
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/perda nominal abaixo/i)).toBeInTheDocument();
    const banner = screen.getByText(/perda nominal abaixo/i).closest("p")!;
    expect(banner).toHaveTextContent(/Carteira/);
  });

  it("renderiza referência ao benchmark no KPI de patrimônio mediano", () => {
    render(wrap(<RiscoPageContent />));
    // KpiCard sub-label shows "Benchmark: R$ 275k" — benchmarkFinal is patrimony's last element
    const benchmarkLabel = screen.getByText(/Benchmark:/i);
    expect(benchmarkLabel).toBeInTheDocument();
    expect(benchmarkLabel).toHaveTextContent(/R\$\s*275/);
  });

  it("mc.isLoading → renderiza skeleton", () => {
    mockMc = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<RiscoPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("mc.error → renderiza ErrorCard", () => {
    mockMc = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});

describe("RiscoPageContent – real mode (R$ de hoje)", () => {
  // horizonYears = years.length - 1 = 3 - 1 = 2
  // IPCA = 0.10, factor = (1.10)^2 = 1.21
  // p50 final (index 2) = 320_000 → deflated = 320_000 / 1.21 ≈ 264_463 → "R$ 264k"
  // benchmarkFinal = 275_000 → deflated at year 2 = 275_000 / 1.21 ≈ 227_273 → "R$ 227k"
  beforeEach(() => {
    mockMc = { data: fakeMcOut, isLoading: false, error: null, refetch: vi.fn() };
    mockSim = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
    mockStore = {
      capital: 230_000,
      targetPatrimony: 0,
      nTrajectories: 2_000,
      displayMode: "real",
      expectedInflation: 0.10,
    };
  });

  it("p50 KPI shows deflated value in real mode", () => {
    render(wrap(<RiscoPageContent />));
    // p50[2] = 320_000 deflated by (1.1)^2 ≈ 264_463 → "R$ 264k"
    expect(screen.getAllByText("R$ 264k").length).toBeGreaterThanOrEqual(1);
  });

  it("benchmark sub shows deflated benchmarkFinal in real mode", () => {
    render(wrap(<RiscoPageContent />));
    // benchmarkFinal = 275_000 deflated by (1.1)^2 ≈ 227_273 → "R$ 227k"
    const benchmarkLabel = screen.getByText(/Benchmark:/i);
    expect(benchmarkLabel).toHaveTextContent(/R\$\s*227/);
  });

  it("'R$ de hoje' badge appears in real mode", () => {
    render(wrap(<RiscoPageContent />));
    const badges = screen.getAllByText("R$ de hoje");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});
