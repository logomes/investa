import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TributacaoPageContent } from "@/components/tributacao/TributacaoPageContent";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut, SimulationResultOut } from "@/lib/api-types";

const years = Array.from({ length: 11 }, (_, i) => i);

function result(gross: number, net: number): SimulationResultOut {
  const grossPatrimony = years.map(() => 0);
  grossPatrimony[10] = gross;
  const patrimony = years.map(() => 0);
  patrimony[10] = net;
  return {
    label: "Carteira",
    color: "#46E8A4",
    years,
    patrimony,
    annualIncome: years.map(() => 0),
    cumulativeIncome: years.map(() => 0),
    grossPatrimony,
    taxPaidCumulative: years.map(() => 0),
    exitTax: years.map(() => 0),
  };
}

const fakeSimOut: SimulateOut = {
  portfolio: result(600_000, 560_000),
  benchmark: result(620_000, 580_000),
  sensitivity: [],
  taxProjection: {
    rows: [
      { name: "Tesouro IPCA+", taxProfile: "rf_regressiva", taxPaidPath: 0, exitTax: 12_000, netFinal: 150_000, grossFinal: 162_000 },
      { name: "Fundo MM", taxProfile: "come_cotas", taxPaidPath: 8_000, exitTax: 900, netFinal: 90_000, grossFinal: 98_900 },
    ],
    taxPaidByYear: years.map((y) => y * 800),
    exitTaxByYear: years.map((y) => y * 1_200),
    allTaxedFinal: 520_000,
  },
};

let mockSimReturn: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useSimulate: () => mockSimReturn,
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

vi.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ xLabels, bands, series }: { xLabels: string[]; bands?: unknown[]; series: { name: string; values: number[] }[] }) => (
    <div data-testid="line-chart" data-xlabels={xLabels.join(",")} data-bands={bands ? bands.length : 0}>
      {series.map((s) => (
        <span key={s.name} data-testid="series-name" data-values={JSON.stringify(s.values)}>{s.name}</span>
      ))}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("TributacaoPageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
    useScenarioStore.setState({ displayMode: "nominal", scenario: { ...DEFAULT_SCENARIO, horizon: 10 } });
  });

  it("renderiza os 4 KPIs da visão forward", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/IR total no horizonte/i)).toBeInTheDocument();
    expect(screen.getByText(/Alíquota efetiva/i)).toBeInTheDocument();
    expect(screen.getByText(/IR latente na saída/i)).toBeInTheDocument();
    expect(screen.getByText(/Suas isenções valem/i)).toBeInTheDocument();
  });

  it("renderiza a timeline (line-chart com bandas) com labels Y0..Y10", () => {
    render(wrap(<TributacaoPageContent />));
    const chart = screen.getByTestId("line-chart");
    expect(chart.dataset.xlabels).toBe("Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7,Y8,Y9,Y10");
    expect(chart.dataset.bands).toBe("1");
  });

  it("renderiza a tabela com uma linha por classe + chip de perfil", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText("Tesouro IPCA+")).toBeInTheDocument();
    expect(screen.getByText("Fundo MM")).toBeInTheDocument();
    expect(screen.getByText("RF regressiva")).toBeInTheDocument();
    // "Come-cotas" appears as a profile chip (and also as a notes title)
    expect(screen.getAllByText("Come-cotas").length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza notas tributárias incluindo come-cotas", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/notas tributárias/i)).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    // come-cotas note body is unique to the notes card
    expect(screen.getByText(/15% sobre o ganho a cada semestre/)).toBeInTheDocument();
  });

  it("não renderiza nenhuma referência a Imóvel", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.queryByText(/Imóvel/)).toBeNull();
  });

  it("modo nominal: timeline não deflaciona (Y10 path = 8000)", () => {
    render(wrap(<TributacaoPageContent />));
    const seriesEls = screen.getAllByTestId("series-name");
    const path = seriesEls.find((el) => el.textContent === "IR pago no caminho")!;
    const values = JSON.parse(path.dataset.values!);
    expect(values[10]).toBeCloseTo(8_000, 3);
  });

  it("modo real: deflaciona valores R$ da timeline pela inflação", () => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, horizon: 10, expectedInflation: 0.10 },
    });
    render(wrap(<TributacaoPageContent />));
    const seriesEls = screen.getAllByTestId("series-name");
    const path = seriesEls.find((el) => el.textContent === "IR pago no caminho")!;
    const values = JSON.parse(path.dataset.values!);
    // year-10 nominal 8000 deflated by (1.1)^10
    expect(values[10]).toBeCloseTo(8_000 / Math.pow(1.1, 10), 3);
  });

  it("modo real: KPIs exibem badge 'R$ de hoje'", () => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, horizon: 10, expectedInflation: 0.10 },
    });
    render(wrap(<TributacaoPageContent />));
    expect(screen.getAllByText(/R\$ de hoje/i).length).toBeGreaterThan(0);
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

  it("tabela: % do bruto = (path+exit)/grossFinal", () => {
    render(wrap(<TributacaoPageContent />));
    // Fundo MM row: (8000 + 900) / 98900 = 9,0%
    const row = screen.getByText("Fundo MM").closest("tr")!;
    expect(within(row).getByText("9,0%")).toBeInTheDocument();
  });
});
