import { describe, it, expect } from "vitest";
import { positionSchema } from "@/lib/fi-schema";

describe("positionSchema", () => {
  it("accepts a valid position", () => {
    const valid = {
      id: crypto.randomUUID(),
      name: "LCI Banco X",
      initialAmount: 30000,
      purchaseDate: "2025-03-15",
      indexer: "cdi",
      rate: 0.95,
      maturityDate: "2027-03-15",
      isTaxExempt: true,
      color: "#3498DB",
    };
    expect(positionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects maturityDate <= purchaseDate", () => {
    const invalid = {
      id: crypto.randomUUID(),
      name: "X",
      initialAmount: 1000,
      purchaseDate: "2025-03-15",
      indexer: "prefixado" as const,
      rate: 0.10,
      maturityDate: "2025-03-14",
      isTaxExempt: false,
      color: "#3498DB",
    };
    const result = positionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/posterior/i);
    }
  });
});
