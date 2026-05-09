import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssetDialog } from "@/components/ativos/AssetDialog";
import * as quotesModule from "@/lib/quotes";

describe("AssetDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it("blur do ticker com valor válido busca cotação e mostra preço inline", async () => {
    const fetchSpy = vi.spyOn(quotesModule, "fetchQuote").mockResolvedValue({
      ticker: "PETR4",
      market: "BR",
      price: 45.67,
      currency: "BRL",
      asOf: new Date(Date.now() - 5 * 60_000).toISOString(),
      source: "brapi",
    });
    render(<AssetDialog open={true} mode="add" onClose={() => {}} onSubmit={() => {}} />);

    const ticker = screen.getByLabelText(/ticker/i);
    fireEvent.change(ticker, { target: { value: "PETR4" } });
    fireEvent.blur(ticker);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("PETR4", "BR"));
    await waitFor(() => expect(screen.getByText(/há 5 min/i)).toBeInTheDocument());
    expect(screen.getByText(/via brapi/i)).toBeInTheDocument();
  });

  it("blur com ticker inválido → exibe erro e não preenche currentPrice", async () => {
    vi.spyOn(quotesModule, "fetchQuote").mockRejectedValue(new quotesModule.QuoteNotFoundError());
    const onSubmit = vi.fn();
    render(<AssetDialog open={true} mode="add" onClose={() => {}} onSubmit={onSubmit} />);

    const ticker = screen.getByLabelText(/ticker/i);
    fireEvent.change(ticker, { target: { value: "ZZZZ" } });
    fireEvent.blur(ticker);

    await waitFor(() => expect(screen.getByText(/Cotação não encontrada/i)).toBeInTheDocument());
  });

  it("submit após fetch success persiste currentPrice + asOf", async () => {
    const asOf = new Date(Date.now() - 60_000).toISOString();
    vi.spyOn(quotesModule, "fetchQuote").mockResolvedValue({
      ticker: "HGCR11",
      market: "BR",
      price: 102.5,
      currency: "BRL",
      asOf,
      source: "brapi",
    });
    const onSubmit = vi.fn();
    render(<AssetDialog open={true} mode="add" onClose={() => {}} onSubmit={onSubmit} />);

    const ticker = screen.getByLabelText(/ticker/i);
    fireEvent.change(ticker, { target: { value: "HGCR11" } });
    fireEvent.blur(ticker);
    await waitFor(() => expect(screen.getByText(/via brapi/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/preço médio/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.currentPrice).toBe(102.5);
    expect(arg.asOf).toBe(asOf);
  });

  it("mode edit com currentPrice + asOf no initial mostra cotação salva", () => {
    const asOf = new Date(Date.now() - 30 * 60_000).toISOString();
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
          currentPrice: 102.5,
          asOf,
        }}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText(/há 30 min/i)).toBeInTheDocument();
    expect(screen.queryByText(/via /i)).not.toBeInTheDocument(); // source="saved" → not shown
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
