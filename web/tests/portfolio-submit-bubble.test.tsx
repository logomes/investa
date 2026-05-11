import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PortfolioSection } from "@/components/scenario-drawer/sections/PortfolioSection";
import { scenarioFormSchema, type ScenarioFormValues } from "@/components/scenario-drawer/schema";
import { DEFAULT_SCENARIO, DEFAULT_MC } from "@/lib/defaults";

// Regression: dialog Salvar must not bubble to ScenarioDrawer's outer <form>.
// Bubbling would call setScenario with stale values and clobber the row update.
function FullDrawerHarness({ initial, onOuterSubmit }: { initial: ScenarioFormValues; onOuterSubmit: (data: ScenarioFormValues) => void }) {
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit(onOuterSubmit);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit}>
        <PortfolioSection />
        <button type="submit">Aplicar cenário</button>
      </form>
    </FormProvider>
  );
}

const base: ScenarioFormValues = { ...DEFAULT_SCENARIO, mc: DEFAULT_MC };

describe("Portfolio submit bubble check", () => {
  it("clicking Salvar in dialog should NOT trigger outer form submit", async () => {
    const onOuterSubmit = vi.fn();
    render(<FullDrawerHarness initial={base} onOuterSubmit={onOuterSubmit} />);

    const firstRow = screen.getByText("FIIs").closest("[data-testid='asset-row']")!;
    fireEvent.click(within(firstRow as HTMLElement).getByLabelText(/editar/i));
    const weightInput = await screen.findByLabelText(/peso/i);
    // FIIs default weight = 50%; push to 75% to land at Σ = 125%
    fireEvent.input(weightInput, { target: { value: "75" } });

    // Click Salvar (real-browser-like)
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      const badge = screen.getByTestId("portfolio-sum-badge");
      expect(badge.textContent).toMatch(/125/);
    });

    // KEY ASSERTION: outer form should NOT have been submitted by the inner Salvar click
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });
});
