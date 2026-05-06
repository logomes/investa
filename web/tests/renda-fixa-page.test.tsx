import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RendaFixaPageContent } from "@/components/renda-fixa/RendaFixaPageContent";
import type { MacroOut } from "@/lib/api-types";
import { useFixedIncomeStore } from "@/lib/fi-store";

const fakeMacro: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

vi.mock("@/lib/api", () => ({
  useMacro: () => ({ data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() }),
  useSimulate: () => ({ data: undefined, isLoading: false, error: null }),
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("RendaFixaPageContent — hydration", () => {
  beforeEach(() => {
    useFixedIncomeStore.setState({ positions: [] });
  });

  it("calls persist.rehydrate() on mount", async () => {
    const spy = vi.spyOn(useFixedIncomeStore.persist, "rehydrate");
    render(wrap(<RendaFixaPageContent />));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it("renders page content after hydration (empty state visible)", async () => {
    render(wrap(<RendaFixaPageContent />));
    await waitFor(() => expect(screen.getByText(/nenhuma posição/i)).toBeInTheDocument());
  });
});
