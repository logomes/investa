import { describe, it, expect, beforeEach } from "vitest";
import { useFixedIncomeStore } from "@/lib/fi-store";

beforeEach(() => {
  useFixedIncomeStore.setState({ positions: [] });
});

describe("fixed-income store", () => {
  it("upsertPosition (add) auto-assigns color from palette", () => {
    useFixedIncomeStore.getState().upsertPosition({
      id: "a", name: "X", initialAmount: 1000, purchaseDate: "2025-01-01",
      indexer: "cdi", rate: 0.95, maturityDate: null, isTaxExempt: true,
    });
    const positions = useFixedIncomeStore.getState().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("upsertPosition (update by id) preserves existing color", () => {
    const store = useFixedIncomeStore.getState();
    store.upsertPosition({
      id: "a", name: "X", initialAmount: 1000, purchaseDate: "2025-01-01",
      indexer: "cdi", rate: 0.95, maturityDate: null, isTaxExempt: true,
    });
    const colorBefore = useFixedIncomeStore.getState().positions[0].color;
    store.upsertPosition({
      id: "a", name: "X-updated", initialAmount: 2000, purchaseDate: "2025-01-01",
      indexer: "cdi", rate: 1.00, maturityDate: null, isTaxExempt: false,
    });
    const positions = useFixedIncomeStore.getState().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].name).toBe("X-updated");
    expect(positions[0].color).toBe(colorBefore);
  });

  it("removePosition removes by id", () => {
    const store = useFixedIncomeStore.getState();
    store.upsertPosition({
      id: "a", name: "X", initialAmount: 1000, purchaseDate: "2025-01-01",
      indexer: "cdi", rate: 0.95, maturityDate: null, isTaxExempt: false,
    });
    store.upsertPosition({
      id: "b", name: "Y", initialAmount: 2000, purchaseDate: "2025-01-01",
      indexer: "ipca", rate: 0.06, maturityDate: null, isTaxExempt: false,
    });
    store.removePosition("a");
    const positions = useFixedIncomeStore.getState().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe("b");
  });
});
