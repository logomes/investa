import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PositionDialog } from "@/components/renda-fixa/PositionDialog";

describe("PositionDialog", () => {
  it("submitting valid form calls onSubmit with payload (no color)", async () => {
    const onSubmit = vi.fn();
    render(
      <PositionDialog
        open
        mode="add"
        onClose={() => {}}
        onSubmit={onSubmit}
        onDelete={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: "Test Bond" } });
    fireEvent.change(screen.getByLabelText(/Aporte/i), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText(/Taxa/i), { target: { value: "1.0" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const arg = onSubmit.mock.calls[0][0];
      expect(arg.name).toBe("Test Bond");
      expect(arg.initialAmount).toBe(5000);
      expect("color" in arg).toBe(false);
    });
  });
});
