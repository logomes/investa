import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("prefills the rate from macro for the selected kind", async () => {
    render(<Wrapper />);
    const rate = screen.getByLabelText(/Taxa anual/i) as HTMLInputElement;
    await waitFor(() => expect(Number(rate.value)).toBeCloseTo(0.149));
    fireEvent.click(screen.getByRole("radio", { name: "Selic" }));
    await waitFor(() => expect(Number(rate.value)).toBeCloseTo(0.15));
  });

  it("shows the spread field only for IPCA+x%", async () => {
    render(<Wrapper />);
    expect(screen.queryByLabelText(/Spread/i)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "IPCA + x%" }));
    expect(screen.getByLabelText(/Spread/i)).toBeInTheDocument();
  });
});
