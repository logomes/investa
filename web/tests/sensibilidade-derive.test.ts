import { describe, it, expect } from "vitest";
import {
  enrichRows,
  sortByImpact,
  tornadoBounds,
} from "@/lib/sensibilidade-derive";
import type { SensitivityRowOut } from "@/lib/api-types";

const SAMPLE: SensitivityRowOut[] = [
  { parameter: "Yield da carteira (±1,5pp)",  pessimistic: 320_000, optimistic: 470_000 },
  { parameter: "Ganho de capital (±1,5pp)",   pessimistic: 340_000, optimistic: 450_000 },
  { parameter: "Aporte mensal (±25%)",        pessimistic: 410_000, optimistic: 380_000 },
  { parameter: "IR efetivo (±5pp)",           pessimistic: 400_000, optimistic: 385_000 },
];

const BASE = 393_000;

describe("sensibilidade-derive — enrichRows", () => {
  it("calcula impactos e amplitude corretamente", () => {
    const enriched = enrichRows(SAMPLE.slice(0, 1), BASE);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      parameter: "Yield da carteira (±1,5pp)",
      label: "Yield da carteira (±1,5pp)",
      pessimistic: 320_000,
      optimistic: 470_000,
      base: 393_000,
      pessImpact: 320_000 - 393_000,
      optImpact: 470_000 - 393_000,
      amplitude: 470_000 - 320_000,
    });
  });

  it("label === parameter (o backend já envia o label humanizado)", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    enriched.forEach((r) => expect(r.label).toBe(r.parameter));
  });

  it("array vazio → retorna vazio", () => {
    expect(enrichRows([], BASE)).toEqual([]);
  });
});

describe("sensibilidade-derive — sortByImpact", () => {
  it("ordena por amplitude descendente (não muta o array original)", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    const sorted = sortByImpact(enriched);
    expect(sorted.map((r) => r.parameter)).toEqual([
      "Yield da carteira (±1,5pp)",
      "Ganho de capital (±1,5pp)",
      "Aporte mensal (±25%)",
      "IR efetivo (±5pp)",
    ]);
    expect(enriched[0].parameter).toBe("Yield da carteira (±1,5pp)");
  });
});

describe("sensibilidade-derive — tornadoBounds", () => {
  it("retorna range simétrico em torno do base", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    const { min, max } = tornadoBounds(enriched, BASE);
    // maior |impact| em SAMPLE: Yield da carteira.optImpact = 470k - 393k = 77k
    // padded = 77k × 1,05 = 80_850
    expect(min).toBeCloseTo(BASE - 80_850, -1);
    expect(max).toBeCloseTo(BASE + 80_850, -1);
    expect(BASE - min).toBeCloseTo(max - BASE, 0);
  });

  it("array vazio → fallback ±10% do base", () => {
    expect(tornadoBounds([], 100_000)).toEqual({ min: 90_000, max: 110_000 });
  });
});
