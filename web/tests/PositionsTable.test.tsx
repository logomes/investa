import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PositionsTable } from "@/components/renda-fixa/PositionsTable";
import type { FixedIncomePosition } from "@/lib/fi-schema";

const positions: FixedIncomePosition[] = [
  {
    id: "a", name: "LCI Banco X", initialAmount: 30000, purchaseDate: "2025-03-15",
    indexer: "cdi", rate: 0.95, maturityDate: "2027-03-15", isTaxExempt: true,
    color: "#3498DB",
  },
  {
    id: "b", name: "Tesouro IPCA+", initialAmount: 50000, purchaseDate: "2024-08-01",
    indexer: "ipca", rate: 0.06, maturityDate: "2035-08-01", isTaxExempt: false,
    color: "#E67E22",
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PositionsTable", () => {
  it("renders one row per position", () => {
    renderWithQuery(
      <PositionsTable
        positions={positions}
        onEdit={() => {}}
        onAdd={() => {}}
        onImportCsv={() => {}}
      />
    );
    expect(screen.getByText("LCI Banco X")).toBeInTheDocument();
    expect(screen.getByText("Tesouro IPCA+")).toBeInTheDocument();
  });

  it("clicking a row calls onEdit with the position", () => {
    const onEdit = vi.fn();
    renderWithQuery(
      <PositionsTable
        positions={positions}
        onEdit={onEdit}
        onAdd={() => {}}
        onImportCsv={() => {}}
      />
    );
    fireEvent.click(screen.getByText("LCI Banco X"));
    expect(onEdit).toHaveBeenCalledWith(positions[0]);
  });
});
