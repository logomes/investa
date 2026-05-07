import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PortfolioSection } from "@/components/scenario-drawer/sections/PortfolioSection";
import { scenarioFormSchema, type ScenarioFormValues } from "@/components/scenario-drawer/schema";
import { DEFAULT_SCENARIO, DEFAULT_MC } from "@/lib/defaults";

function Harness({ initial }: { initial: ScenarioFormValues }) {
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: initial,
  });
  return (
    <FormProvider {...form}>
      <PortfolioSection />
      <output data-testid="assets-count">
        {form.watch("portfolio.assets").length}
      </output>
    </FormProvider>
  );
}

const base: ScenarioFormValues = { ...DEFAULT_SCENARIO, mc: DEFAULT_MC };

describe("PortfolioSection", () => {
  it("shows green Σ badge when weights sum to 100%", () => {
    render(<Harness initial={base} />);
    const badge = screen.getByTestId("portfolio-sum-badge");
    expect(badge.textContent).toMatch(/100/);
    expect(badge.className).toMatch(/green|emerald|brand/);
  });

  it("shows red Σ badge when weights ≠ 100%", () => {
    const broken = {
      ...base,
      portfolio: {
        ...base.portfolio,
        assets: base.portfolio.assets.map((a, i) => (i === 0 ? { ...a, weight: 0.5 } : a)),
      },
    };
    render(<Harness initial={broken} />);
    const badge = screen.getByTestId("portfolio-sum-badge");
    expect(badge.className).toMatch(/red|coral/);
  });

  it("clicking + Adicionar opens the asset dialog", () => {
    render(<Harness initial={base} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.getByText("Adicionar ativo")).toBeInTheDocument();
  });

  it("clicking the trash icon on a row removes that asset (after confirm)", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness initial={base} />);
    expect(screen.getByTestId("assets-count").textContent).toBe("5");
    const firstRow = screen.getByText("FIIs de Papel").closest("[data-testid='asset-row']")!;
    fireEvent.click(within(firstRow as HTMLElement).getByLabelText(/excluir/i));
    expect(screen.getByTestId("assets-count").textContent).toBe("4");
    confirmSpy.mockRestore();
  });
});
