import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { PortfolioSection } from "@/components/scenario-drawer/sections/PortfolioSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import { useAssetsStore } from "@/lib/ativos-store";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { useScenarioStore } from "@/lib/store";
import type { ScenarioFormValues } from "@/components/scenario-drawer/schema";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

let lastValues: ScenarioFormValues | null = null;

function Wrapper() {
  const form = useForm<ScenarioFormValues>({
    defaultValues: { ...DEFAULT_SCENARIO, mc: { nTrajectories: 2000, seed: null, targetPatrimony: 0 } },
  });
  lastValues = null;
  return (
    <FormProvider {...form}>
      <PortfolioSection />
      <button type="button" onClick={() => { lastValues = form.getValues(); }}>read-form</button>
    </FormProvider>
  );
}

const HGLG = {
  id: "HGLG11", ticker: "HGLG11", assetClass: "FII" as const, currency: "BRL" as const,
  quantity: 100, avgPrice: 100, expectedYield: 0.11, capitalGain: 0.01, color: "#FFC857",
};

describe("PortfolioSection — Usar carteira real", () => {
  beforeEach(() => {
    localStorage.clear();
    useAssetsStore.setState({ positions: [] });
    useFixedIncomeStore.setState({ positions: [] });
    useScenarioStore.setState({ lastRealImportAt: null });
  });

  it("disables the button when there are no real positions", () => {
    render(<Wrapper />);
    expect(screen.getByRole("button", { name: /Usar carteira real/i })).toBeDisabled();
  });

  it("previews and replaces the form portfolio on confirm", () => {
    useAssetsStore.setState({ positions: [HGLG] });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Usar carteira real/i }));
    expect(screen.getByText(/R\$\s*10\.000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Substituir cenário/i }));
    fireEvent.click(screen.getByText("read-form"));
    expect(lastValues!.portfolio.assets).toHaveLength(1);
    expect(lastValues!.portfolio.assets[0].name).toBe("FII (Papel/Tijolo/Agro/FoF)");
    expect(lastValues!.portfolio.capital).toBe(10_000);
    expect(lastValues!.capital).toBe(10_000);
    expect(useScenarioStore.getState().lastRealImportAt).not.toBeNull();
    expect(screen.getByText(/Importado da carteira real em/i)).toBeInTheDocument();
  });

  it("cancel closes the preview without touching the form", () => {
    useAssetsStore.setState({ positions: [HGLG] });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Usar carteira real/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    fireEvent.click(screen.getByText("read-form"));
    expect(lastValues!.portfolio.assets).toHaveLength(DEFAULT_SCENARIO.portfolio.assets.length);
    expect(useScenarioStore.getState().lastRealImportAt).toBeNull();
  });

  it("reset clears the provenance stamp", () => {
    useAssetsStore.setState({ positions: [HGLG] });
    useScenarioStore.setState({ lastRealImportAt: "2026-06-11T12:00:00.000Z" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));
    expect(useScenarioStore.getState().lastRealImportAt).toBeNull();
  });
});
