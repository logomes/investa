import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LciCdbCard } from "@/components/tributacao/LciCdbCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import { equivalentCdbRate } from "@/lib/tax-compare";
import { formatPercent } from "@/lib/format";
import type { MacroOut } from "@/lib/api-types";

let mockMacroReturn: { data: MacroOut | undefined; isLoading: boolean; error: Error | null };

vi.mock("@/lib/api", () => ({
  useMacro: () => mockMacroReturn,
}));

const macro: MacroOut = {
  selic: 0.105,
  cdi: 0.105,
  ipca: 0.04,
  usdBrl: 5.4,
  isStale: false,
  sourceLabel: "BCB",
};

describe("LciCdbCard", () => {
  beforeEach(() => {
    mockMacroReturn = { data: undefined, isLoading: false, error: null };
    // First isento asset yields 9% → default input.
    useScenarioStore.setState({
      displayMode: "nominal",
      scenario: {
        ...DEFAULT_SCENARIO,
        horizon: 10,
        portfolio: {
          ...DEFAULT_SCENARIO.portfolio,
          assets: [
            { name: "LCI", weight: 1, expectedYield: 0.09, capitalGain: 0, taxRate: 0, note: "", volatility: 0.03, taxProfile: "isento" },
          ],
        },
      },
    });
  });

  it("renderiza o CDB equivalente para a taxa isenta default (9% a.a., h=10)", () => {
    render(<LciCdbCard />);
    const expected = formatPercent(equivalentCdbRate(0.09, 10), 2);
    expect(screen.getByText("CDB equivalente (a.a.)")).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("mostra '% do CDI' quando o macro está disponível", () => {
    mockMacroReturn = { data: macro, isLoading: false, error: null };
    render(<LciCdbCard />);
    expect(screen.getByText(/% do CDI/i)).toBeInTheDocument();
    const pctOfCdi = formatPercent(equivalentCdbRate(0.09, 10) / macro.cdi, 1);
    expect(screen.getByText(pctOfCdi)).toBeInTheDocument();
  });

  it("omite '% do CDI' quando o macro está ausente", () => {
    mockMacroReturn = { data: undefined, isLoading: false, error: null };
    render(<LciCdbCard />);
    expect(screen.queryByText(/% do CDI/i)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
