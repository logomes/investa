import { describe, it, expect } from "vitest";
import { exportCsv, importCsv } from "@/lib/fi-csv";
import type { FixedIncomePosition } from "@/lib/fi-schema";

const sample: FixedIncomePosition = {
  id: "x",
  name: "LCI Banco X",
  initialAmount: 30000,
  purchaseDate: "2025-03-15",
  indexer: "cdi",
  rate: 0.95,
  maturityDate: "2027-03-15",
  isTaxExempt: true,
  color: "#3498DB",
};

describe("fi-csv", () => {
  it("round-trip preserva todos os campos do dataclass", () => {
    const csv = exportCsv([sample]);
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.positions).toHaveLength(1);
    const p = result.positions[0];
    expect(p.name).toBe(sample.name);
    expect(p.initialAmount).toBe(sample.initialAmount);
    expect(p.purchaseDate).toBe(sample.purchaseDate);
    expect(p.indexer).toBe(sample.indexer);
    expect(p.rate).toBe(sample.rate);
    expect(p.maturityDate).toBe(sample.maturityDate);
    expect(p.isTaxExempt).toBe(sample.isTaxExempt);
    // id and color are regenerated, not asserted
  });

  it("indexer inválido retorna erro com path", () => {
    const csv =
      "name,initialAmount,purchaseDate,indexer,rate,maturityDate,isTaxExempt\n" +
      "X,1000,2025-01-01,bitcoin,0.10,,false\n";
    const result = importCsv(csv);
    expect(result.positions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toMatch(/indexer/i);
  });

  it("bool string 'true'/'false'/'True'/'1' coerce corretamente", () => {
    const csv =
      "name,initialAmount,purchaseDate,indexer,rate,maturityDate,isTaxExempt\n" +
      "A,1000,2025-01-01,cdi,1.0,,true\n" +
      "B,1000,2025-01-01,cdi,1.0,,false\n" +
      "C,1000,2025-01-01,cdi,1.0,,1\n" +
      "D,1000,2025-01-01,cdi,1.0,,True\n";
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.positions[0].isTaxExempt).toBe(true);
    expect(result.positions[1].isTaxExempt).toBe(false);
    expect(result.positions[2].isTaxExempt).toBe(true);
    expect(result.positions[3].isTaxExempt).toBe(true);
  });

  it("maturity vazia mapeia para null", () => {
    const csv =
      "name,initialAmount,purchaseDate,indexer,rate,maturityDate,isTaxExempt\n" +
      "X,1000,2025-01-01,cdi,1.0,,false\n";
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.positions[0].maturityDate).toBeNull();
  });
});
