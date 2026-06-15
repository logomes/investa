import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { CapitalSection } from "@/components/scenario-drawer/sections/CapitalSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.051, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

function Wrapper() {
  const form = useForm({ defaultValues: { ...DEFAULT_SCENARIO } });
  return (
    <FormProvider {...form}>
      <CapitalSection />
    </FormProvider>
  );
}

describe("CapitalSection — inflação projetada", () => {
  it("renders the field prefilled from the scenario", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/Inflação projetada/i) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(0.045);
  });

  it("shows the live BCB value as caption without overwriting the field", () => {
    render(<Wrapper />);
    expect(screen.getByText(/BCB hoje: 5,1%/)).toBeInTheDocument();
    const input = screen.getByLabelText(/Inflação projetada/i) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(0.045); // not 0.051
  });
});
