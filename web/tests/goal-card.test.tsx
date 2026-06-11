import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalCard } from "@/components/visao-geral/GoalCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_GOAL } from "@/lib/defaults";
import type { SimulateOut, SimulateMonteCarloOut, MacroOut } from "@/lib/api-types";

let simPatrimony: number[] = [230_000, 250_000];
let mcDist: number[] = [];

const goalSolveMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  data: undefined as
    | undefined
    | {
        requiredMonthlyContribution: number;
        achievedProbability: number;
        attainable: boolean;
        iterations: number;
      },
}));

function makeSim(patrimony: number[]): SimulateOut {
  return {
    portfolio: { label: "PF", color: "#fff", years: [0, 1], patrimony, annualIncome: [0, 5_000], cumulativeIncome: [0, 5_000] },
    benchmark: { label: "BM", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 0], cumulativeIncome: [0, 0] },
    sensitivity: [],
    taxComparison: [],
  };
}

function makeMc(distribution: number[]): SimulateMonteCarloOut {
  const mkResult = (d: number[]) => ({
    label: "PF",
    color: "#fff",
    p10: [], p50: [], p90: [],
    finalDistribution: d,
    maxDrawdowns: [],
  });
  return { portfolio: mkResult(distribution) };
}

const fakeMacro: MacroOut = {
  selic: 0.12, cdi: 0.12, ipca: 0.04, usdBrl: 5,
  isStale: false, sourceLabel: "test",
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: makeSim(simPatrimony), isLoading: false, error: null, refetch: vi.fn() }),
  useMonteCarlo: () => ({ data: makeMc(mcDist), isLoading: false, error: null, refetch: vi.fn() }),
  useMacro: () => ({ data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() }),
  useGoalSolve: () => goalSolveMock,
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

// wrapper function for { wrapper } pattern used in new tests
const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("GoalCard editable target", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
    simPatrimony = [230_000, 250_000];
    mcDist = [];
    goalSolveMock.data = undefined;
    goalSolveMock.isPending = false;
    goalSolveMock.isError = false;
    goalSolveMock.mutate.mockClear();
  });

  it("renders the goal as a button by default (not in edit mode)", () => {
    render(wrap(<GoalCard />));
    expect(screen.getByRole("button", { name: /editar meta/i })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });

  it("clicking the goal switches to input mode with the current value pre-filled", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe(String(DEFAULT_GOAL));
  });

  it("pressing Enter with a valid positive number commits and exits edit mode", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "800000");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(800_000);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/800/);
  });

  it("pressing Esc cancels without calling setGoalTarget", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "999999");
    await user.keyboard("{Escape}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });

  it("submitting empty/zero/negative reverts silently without changing the store", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "0");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "-100");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
  });
});

describe("GoalCard recommendation states", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
    simPatrimony = [230_000, 250_000];
    mcDist = [];
    goalSolveMock.data = undefined;
    goalSolveMock.isPending = false;
    goalSolveMock.isError = false;
    goalSolveMock.mutate.mockClear();
  });

  it("renders 'Meta atingida' when capital >= goal", () => {
    useScenarioStore.setState({ goalTarget: 100_000 });
    simPatrimony = [230_000, 250_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/Meta atingida/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("renders 'Aporte atual já é suficiente' when projectedFinal >= goal", () => {
    useScenarioStore.setState({ goalTarget: 240_000 });
    simPatrimony = [230_000, 250_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/já é suficiente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("renders 'Aporte de R$ X/mês' + apply button for below state", () => {
    useScenarioStore.setState({ goalTarget: 600_000 });
    simPatrimony = [230_000, 300_000];
    render(wrap(<GoalCard />));
    // Text is split across elements (span inside p), use container textContent check
    expect(screen.getByText((_, el) => !!el && /Aporte de/.test(el.textContent ?? "") && el.tagName === "P")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aplicar sugest/i })).toBeInTheDocument();
  });

  it("renders 'Meta improvável' for unreachable state (no apply button)", () => {
    useScenarioStore.setState({ goalTarget: 50_000_000 });
    simPatrimony = [230_000, 300_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/improv[áa]vel/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("clicking Apply updates scenario.portfolio.monthlyContribution", async () => {
    const user = userEvent.setup();
    useScenarioStore.setState({ goalTarget: 600_000 });
    simPatrimony = [230_000, 300_000];
    const before = useScenarioStore.getState().scenario.portfolio.monthlyContribution;
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /aplicar sugest/i }));
    const after = useScenarioStore.getState().scenario.portfolio.monthlyContribution;
    expect(after).toBeGreaterThan(before);
  });

  it("probability badge shows percentage from MC finalDistribution", () => {
    useScenarioStore.setState({ goalTarget: 500_000 });
    simPatrimony = [230_000, 300_000];
    mcDist = [100_000, 200_000, 300_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_100_000];
    render(wrap(<GoalCard />));
    // formatPercent uses Brazilian locale: 70,0% — match the <p> containing probability badge
    expect(screen.getByText((_, el) => !!el && el.tagName === "P" && /70[,.]0%/.test(el.textContent ?? "") && /prov[áa]vel/i.test(el.textContent ?? ""))).toBeInTheDocument();
  });
});

describe("GoalCard Monte Carlo refinement", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
    simPatrimony = [230_000, 300_000];
    mcDist = [];
    goalSolveMock.data = undefined;
    goalSolveMock.isPending = false;
    goalSolveMock.isError = false;
    goalSolveMock.mutate.mockClear();
  });

  it("renders the refine button and fires the mutation with the scenario", () => {
    render(<GoalCard />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Refinar com Monte Carlo/i }));
    expect(goalSolveMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 0.8, horizon: expect.any(Number), nTrajectories: 1500 }),
    );
  });

  it("shows the solver result with an apply button", () => {
    goalSolveMock.data = {
      requiredMonthlyContribution: 2_345,
      achievedProbability: 0.82,
      attainable: true,
      iterations: 9,
    };
    render(<GoalCard />, { wrapper });
    expect(screen.getByText(/R\$\s*2\.345/)).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aplicar aporte refinado/i })).toBeInTheDocument();
  });

  it("applying the refined contribution mutates the scenario", () => {
    goalSolveMock.data = {
      requiredMonthlyContribution: 2_345,
      achievedProbability: 0.82,
      attainable: true,
      iterations: 9,
    };
    render(<GoalCard />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar aporte refinado/i }));
    expect(useScenarioStore.getState().scenario.portfolio.monthlyContribution).toBe(2_345);
  });

  it("renders the unattainable message", () => {
    goalSolveMock.data = {
      requiredMonthlyContribution: 50_000,
      achievedProbability: 0.4,
      attainable: false,
      iterations: 0,
    };
    render(<GoalCard />, { wrapper });
    expect(screen.getByText(/improvável mesmo com R\$\s*50\.000/i)).toBeInTheDocument();
  });
});
