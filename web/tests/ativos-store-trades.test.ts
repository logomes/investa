import { describe, it, expect, beforeEach } from "vitest";
import { useAssetsStore } from "@/lib/ativos-store";
import type { B3Trade } from "@/lib/b3-import";

const t = (overrides: Partial<B3Trade> & { ticker: string; date: string; side: "buy" | "sell" }): B3Trade => ({
  quantity: 100,
  price: 30,
  ...overrides,
});

describe("useAssetsStore.mergeTrades", () => {
  beforeEach(() => {
    useAssetsStore.setState({ trades: [] });
  });

  it("primeiro import popula o array", () => {
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy" }),
      t({ ticker: "VALE3", date: "2026-02-15", side: "sell" }),
    ]);
    expect(useAssetsStore.getState().trades).toHaveLength(2);
  });

  it("import overlapping deduplica trades idênticos", () => {
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy" }),
    ]);
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy" }), // mesmo
      t({ ticker: "VALE3", date: "2026-02-15", side: "sell" }), // novo
    ]);
    const trades = useAssetsStore.getState().trades;
    expect(trades).toHaveLength(2); // PETR4 + VALE3, não 3
  });

  it("trades com preço diferente são considerados distintos (não dedupe)", () => {
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy", price: 30 }),
    ]);
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy", price: 31 }),
    ]);
    expect(useAssetsStore.getState().trades).toHaveLength(2);
  });

  it("ordena por data crescente após cada merge", () => {
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "X", date: "2026-03-01", side: "buy" }),
    ]);
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "Y", date: "2026-01-01", side: "buy" }),
    ]);
    const trades = useAssetsStore.getState().trades;
    expect(trades[0].ticker).toBe("Y");
    expect(trades[1].ticker).toBe("X");
  });

  it("clearTrades zera o array", () => {
    useAssetsStore.getState().mergeTrades([
      t({ ticker: "PETR4", date: "2026-01-10", side: "buy" }),
    ]);
    useAssetsStore.getState().clearTrades();
    expect(useAssetsStore.getState().trades).toEqual([]);
  });

  it("simula 6 imports anuais (2020–2025) sem perder histórico", () => {
    const years = ["2020", "2021", "2022", "2023", "2024", "2025"];
    for (const y of years) {
      useAssetsStore.getState().mergeTrades([
        t({ ticker: "PETR4", date: `${y}-06-15`, side: "buy" }),
      ]);
    }
    expect(useAssetsStore.getState().trades).toHaveLength(6);
    expect(useAssetsStore.getState().trades[0].date).toBe("2020-06-15");
    expect(useAssetsStore.getState().trades[5].date).toBe("2025-06-15");
  });
});
