import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FinancingSection } from "@/components/scenario-drawer/sections/FinancingSection";
import { scenarioFormSchema, type ScenarioFormValues } from "@/components/scenario-drawer/schema";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_FINANCING } from "@/lib/defaults";

function Harness({ initial }: { initial: ScenarioFormValues }) {
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: initial,
  });
  return (
    <FormProvider {...form}>
      <FinancingSection />
      <output data-testid="financing-state">
        {JSON.stringify(form.watch("realEstate.financing"))}
      </output>
    </FormProvider>
  );
}

const baseValues: ScenarioFormValues = { ...DEFAULT_SCENARIO, mc: DEFAULT_MC };

describe("FinancingSection", () => {
  it("toggle desligado quando financing é null; campos não aparecem", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
    expect(screen.queryByLabelText(/prazo \(anos\)/i)).not.toBeInTheDocument();
  });

  it("toggle ligado expõe 5 campos (4 inputs + 1 select)", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: DEFAULT_FINANCING } }} />);
    expect(screen.getByLabelText(/prazo \(anos\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/taxa anual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/entrada/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seguro mensal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sistema/i)).toBeInTheDocument();
  });

  it("ligar toggle preenche financing com DEFAULT_FINANCING", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    const state = screen.getByTestId("financing-state").textContent!;
    const parsed = JSON.parse(state);
    expect(parsed).toEqual(DEFAULT_FINANCING);
  });

  it("desligar toggle volta financing para null", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: DEFAULT_FINANCING } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
  });

  it("ciclo off→on→off não vaza valores", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
  });
});
