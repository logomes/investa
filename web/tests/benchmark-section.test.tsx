import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { BenchmarkSection } from "@/components/scenario-drawer/sections/BenchmarkSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

function Wrapper() {
  const form = useForm({ defaultValues: { benchmark: DEFAULT_SCENARIO.benchmark } });
  return (
    <FormProvider {...form}>
      <BenchmarkSection />
    </FormProvider>
  );
}

describe("BenchmarkSection", () => {
  it("renders the three kind options with CDI selected by default", () => {
    render(<Wrapper />);
    expect(screen.getByRole("radio", { name: "CDI" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Selic" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "IPCA + x%" })).toHaveAttribute("aria-checked", "false");
  });

  it("does not prefill the rate on mount; clicking a kind refreshes it", () => {
    render(<Wrapper />);
    const rate = screen.getByLabelText(/Taxa anual/i) as HTMLInputElement;
    // On mount the saved rate must survive — no effect overwrites it
    expect(Number(rate.value)).toBeCloseTo(DEFAULT_SCENARIO.benchmark.annualRate);
    // Clicking Selic triggers an interaction-driven prefill
    fireEvent.click(screen.getByRole("radio", { name: "Selic" }));
    expect(Number(rate.value)).toBeCloseTo(0.15);
    // Clicking CDI prefills with CDI rate
    fireEvent.click(screen.getByRole("radio", { name: "CDI" }));
    expect(Number(rate.value)).toBeCloseTo(0.149);
  });

  it("selecting IPCA+x% then editing spread updates the rate", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("radio", { name: "IPCA + x%" }));
    const spread = screen.getByLabelText(/Spread/i) as HTMLInputElement;
    fireEvent.change(spread, { target: { value: "0.06", valueAsNumber: 0.06 } });
    const rate = screen.getByLabelText(/Taxa anual/i) as HTMLInputElement;
    // ipca (0.045) + spread (0.06) = 0.105
    expect(Number(rate.value)).toBeCloseTo(0.105);
  });

  it("manual rate edit survives (no mount effect); interaction-driven click still wins", () => {
    render(<Wrapper />);
    const rate = screen.getByLabelText(/Taxa anual/i) as HTMLInputElement;
    // Manually set the rate
    fireEvent.change(rate, { target: { value: "0.2", valueAsNumber: 0.2 } });
    expect(Number(rate.value)).toBeCloseTo(0.2);
    // No automatic mount effect — rate stays at 0.2
    expect(Number(rate.value)).toBeCloseTo(0.2);
    // Clicking Selic is an explicit interaction — rate refreshes to macro value
    fireEvent.click(screen.getByRole("radio", { name: "Selic" }));
    expect(Number(rate.value)).toBeCloseTo(0.15);
  });

  it("shows the spread field only for IPCA+x%", () => {
    render(<Wrapper />);
    expect(screen.queryByLabelText(/Spread/i)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "IPCA + x%" }));
    expect(screen.getByLabelText(/Spread/i)).toBeInTheDocument();
  });
});
