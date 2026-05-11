import { describe, it, expect, beforeEach } from "vitest";
import { useAssetsStore } from "@/lib/ativos-store";
import type { B3PaidProvent } from "@/lib/b3-import";

const p = (overrides: Partial<B3PaidProvent> & { ticker: string; paidDate: string }): B3PaidProvent => ({
  type: "Rendimento",
  netValue: 100,
  ...overrides,
});

describe("useAssetsStore.mergeProventsPaid", () => {
  beforeEach(() => {
    useAssetsStore.setState({ proventsPaid: [] });
  });

  it("primeiro merge popula o array", () => {
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "HGCR11", paidDate: "2026-03-15" }),
      p({ ticker: "PETR4", paidDate: "2026-03-20", netValue: 50 }),
    ]);
    expect(useAssetsStore.getState().proventsPaid).toHaveLength(2);
  });

  it("dedupe por date|ticker|type|netValue", () => {
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "HGCR11", paidDate: "2026-03-15", netValue: 120 }),
    ]);
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "HGCR11", paidDate: "2026-03-15", netValue: 120 }), // mesmo
      p({ ticker: "MXRF11", paidDate: "2026-03-15", netValue: 80 }),
    ]);
    expect(useAssetsStore.getState().proventsPaid).toHaveLength(2);
  });

  it("netValue diferente conta como provento distinto", () => {
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "HGCR11", paidDate: "2026-03-15", netValue: 120 }),
    ]);
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "HGCR11", paidDate: "2026-03-15", netValue: 130 }),
    ]);
    expect(useAssetsStore.getState().proventsPaid).toHaveLength(2);
  });

  it("ordena por data crescente após cada merge", () => {
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "X", paidDate: "2026-05-01" }),
    ]);
    useAssetsStore.getState().mergeProventsPaid([
      p({ ticker: "Y", paidDate: "2026-01-01" }),
    ]);
    const list = useAssetsStore.getState().proventsPaid;
    expect(list[0].paidDate).toBe("2026-01-01");
    expect(list[1].paidDate).toBe("2026-05-01");
  });

  it("clearProventsPaid zera o array", () => {
    useAssetsStore.getState().mergeProventsPaid([p({ ticker: "HGCR11", paidDate: "2026-03-15" })]);
    useAssetsStore.getState().clearProventsPaid();
    expect(useAssetsStore.getState().proventsPaid).toEqual([]);
  });
});
