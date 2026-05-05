import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetDialog } from "@/components/ativos/AssetDialog";

describe("AssetDialog", () => {
  it("mode add → renderiza campos com defaults da classe FII Papel", () => {
    render(
      <AssetDialog
        open={true}
        mode="add"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/classe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/moeda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preço médio/i)).toBeInTheDocument();
  });

  it("submit válido chama onSubmit com yields decimais", async () => {
    const onSubmit = vi.fn();
    render(
      <AssetDialog open={true} mode="add" onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText(/ticker/i), { target: { value: "HGCR11" } });
    fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/preço médio/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/yield esperado/i), { target: { value: "13" } });
    fireEvent.change(screen.getByLabelText(/ganho capital/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalled();
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.expectedYield).toBeCloseTo(0.13, 5);
    expect(arg.capitalGain).toBeCloseTo(0, 5);
  });

  it("ticker vazio → form não submete", async () => {
    const onSubmit = vi.fn();
    render(
      <AssetDialog open={true} mode="add" onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("mode edit com initial → campos pre-populated", () => {
    render(
      <AssetDialog
        open={true}
        mode="edit"
        initial={{
          id: "1",
          ticker: "HGCR11",
          assetClass: "FII_PAPEL",
          currency: "BRL",
          quantity: 100,
          avgPrice: 100,
          expectedYield: 0.13,
          capitalGain: 0,
          color: "#FFC857",
        }}
        onClose={() => {}}
        onSubmit={() => {}}
        onDelete={() => {}}
      />,
    );
    const ticker = screen.getByLabelText(/ticker/i) as HTMLInputElement;
    expect(ticker.value).toBe("HGCR11");
    // Yield rendered as percent (13, not 0.13)
    const yld = screen.getByLabelText(/yield esperado/i) as HTMLInputElement;
    expect(parseFloat(yld.value)).toBeCloseTo(13, 1);
  });

  it("mode edit mostra botão Excluir", () => {
    render(
      <AssetDialog
        open={true}
        mode="edit"
        initial={{
          id: "1",
          ticker: "HGCR11",
          assetClass: "FII_PAPEL",
          currency: "BRL",
          quantity: 100,
          avgPrice: 100,
          expectedYield: 0.13,
          capitalGain: 0,
          color: "#FFC857",
        }}
        onClose={() => {}}
        onSubmit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /excluir/i })).toBeInTheDocument();
  });
});
