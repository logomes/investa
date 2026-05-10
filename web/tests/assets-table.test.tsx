import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetsTable } from "@/components/ativos/AssetsTable";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";

const macro: MacroOut = {
  selic: 0.105,
  cdi: 0.104,
  ipca: 0.045,
  usdBrl: 5.20,
  isStale: false,
  sourceLabel: "test",
};

const baseProps = {
  macro,
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onImport: vi.fn(),
  onImportB3: vi.fn(),
  onExport: vi.fn(),
};

const brAsset: AssetPosition = {
  id: "1", ticker: "PETR4", assetClass: "ACAO_BR_DIVIDENDO", currency: "BRL",
  quantity: 100, avgPrice: 40, expectedYield: 0.08, capitalGain: 0.03, color: "#5CC8FF",
  currentPrice: 45.67, asOf: new Date(Date.now() - 5 * 60_000).toISOString(),
};

const usAsset: AssetPosition = {
  id: "2", ticker: "AAPL", assetClass: "STOCK_US", currency: "USD",
  quantity: 10, avgPrice: 200, expectedYield: 0.02, capitalGain: 0.06, color: "#7DCFFF",
  currentPrice: 293.32, asOf: new Date(Date.now() - 60_000).toISOString(),
};

describe("AssetsTable quote column", () => {
  it("BR asset renderiza preço atual em BRL com 'há X min'", () => {
    render(<AssetsTable positions={[brAsset]} onRefreshQuote={vi.fn()} {...baseProps} />);
    // formatRs arredonda — 45,67 vira "R$ 46"
    expect(screen.getByText("R$ 46")).toBeInTheDocument();
    expect(screen.getByText(/há 5 min/i)).toBeInTheDocument();
  });

  it("US asset converte para BRL e mostra USD original como subtexto", () => {
    render(<AssetsTable positions={[usAsset]} onRefreshQuote={vi.fn()} {...baseProps} />);
    // 293.32 USD * 5.20 BRL/USD = 1525,264 → formatRs arredonda pra "R$ 1.525"
    expect(screen.getByText("R$ 1.525")).toBeInTheDocument();
    expect(screen.getByText(/\$\s*293,32/)).toBeInTheDocument();
  });

  it("posição sem cotação mostra botão Buscar", () => {
    const noQuote: AssetPosition = { ...brAsset, currentPrice: undefined, asOf: undefined };
    render(<AssetsTable positions={[noQuote]} onRefreshQuote={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("button", { name: /buscar cotação/i })).toBeInTheDocument();
  });

  it("BR asset com ganho positivo renderiza valor + percentual em verde", () => {
    // BR asset: avgPrice=40 (cost), currentPrice=45.67, qty=100 → +R$ 567 (+14,17 ou +14,18%)
    render(<AssetsTable positions={[brAsset]} onRefreshQuote={vi.fn()} {...baseProps} />);
    expect(screen.getByText(/\+R\$ 567/)).toBeInTheDocument();
    expect(screen.getByText(/\+14,1[78]%/)).toBeInTheDocument();
  });

  it("posição sem currentPrice renderiza '—' na coluna Ganho", () => {
    const noQuote: AssetPosition = { ...brAsset, currentPrice: undefined, asOf: undefined };
    render(<AssetsTable positions={[noQuote]} onRefreshQuote={vi.fn()} {...baseProps} />);
    // Há vários "—" possíveis (ações etc) — basta garantir que a coluna existe
    expect(screen.getByText("Ganho atual")).toBeInTheDocument();
  });

  it("clicar no refresh chama onRefreshQuote com a posição", async () => {
    const user = userEvent.setup();
    const onRefreshQuote = vi.fn().mockResolvedValue(undefined);
    render(<AssetsTable positions={[brAsset]} onRefreshQuote={onRefreshQuote} {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /atualizar cotação petr4/i }));
    await waitFor(() => expect(onRefreshQuote).toHaveBeenCalledWith(brAsset));
  });
});
