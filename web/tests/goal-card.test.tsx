import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalCard } from "@/components/visao-geral/GoalCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_GOAL } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";

const fakeSim: SimulateOut = {
  realEstate: { label: "RE", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 12], cumulativeIncome: [0, 12] },
  portfolio: { label: "PF", color: "#fff", years: [0, 1], patrimony: [230_000, 250_000], annualIncome: [0, 5_000], cumulativeIncome: [0, 5_000] },
  benchmark: { label: "BM", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 0], cumulativeIncome: [0, 0] },
  sensitivity: [],
  taxComparison: [],
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: fakeSim, isLoading: false, error: null, refetch: vi.fn() }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("GoalCard editable target", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
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
});
