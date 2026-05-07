import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PortfolioAssetDialog } from "@/components/scenario-drawer/PortfolioAssetDialog";
import type { PortfolioAssetInput } from "@/lib/api-types";

describe("PortfolioAssetDialog", () => {
  let onSubmit: ReturnType<typeof vi.fn<(asset: PortfolioAssetInput) => void>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onDelete: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onSubmit = vi.fn<(asset: PortfolioAssetInput) => void>();
    onClose = vi.fn<() => void>();
    onDelete = vi.fn<() => void>();
  });

  it("submits with decimal-converted values from percent inputs", async () => {
    render(
      <PortfolioAssetDialog
        open
        mode="add"
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    fireEvent.input(screen.getByLabelText(/nome/i), { target: { value: "Custom A" } });
    fireEvent.input(screen.getByLabelText(/peso/i), { target: { value: "10" } });
    const form = screen.getByRole("button", { name: /salvar/i }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0] as PortfolioAssetInput;
    expect(arg.name).toBe("Custom A");
    expect(arg.weight).toBeCloseTo(0.1, 5);
  });

  it("in edit mode, Excluir button is visible and calls onDelete after confirm", () => {
    const initial: PortfolioAssetInput = {
      name: "FIIs Papel",
      weight: 0.25,
      expectedYield: 0.13,
      capitalGain: 0,
      taxRate: 0,
      note: "",
      volatility: 0.14,
    };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <PortfolioAssetDialog
        open
        mode="edit"
        initial={initial}
        onClose={onClose}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it("in add mode, picking type populates yield/capGain/taxRate/volatility defaults", () => {
    render(
      <PortfolioAssetDialog
        open
        mode="add"
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    // STOCK_US has yield=4%, capGain=6%, taxRate=30%, volatility=18%
    const typeSelect = screen.getByLabelText(/tipo/i) as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "STOCK_US" } });
    expect((screen.getByLabelText(/yield esperado/i) as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText(/ganho capital/i) as HTMLInputElement).value).toBe("6");
    expect((screen.getByLabelText(/imposto/i) as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText(/volatilidade/i) as HTMLInputElement).value).toBe("18");
  });
});
