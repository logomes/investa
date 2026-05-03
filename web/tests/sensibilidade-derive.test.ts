import { describe, it, expect } from "vitest";
import {
  PARAMETER_LABELS,
  paramLabel,
  enrichRows,
  sortByImpact,
  tornadoBounds,
} from "@/lib/sensibilidade-derive";
import type { SensitivityRowOut } from "@/lib/api-types";

const SAMPLE: SensitivityRowOut[] = [
  { parameter: "monthly_rent",            pessimistic: 320_000, optimistic: 470_000 },
  { parameter: "annual_appreciation",     pessimistic: 340_000, optimistic: 450_000 },
  { parameter: "vacancy_months_per_year", pessimistic: 410_000, optimistic: 380_000 },
  { parameter: "management_fee_pct",      pessimistic: 400_000, optimistic: 385_000 },
  { parameter: "iptu_rate",               pessimistic: 395_000, optimistic: 390_000 },
  { parameter: "income_tax_bracket",      pessimistic: 393_000, optimistic: 392_500 },
];

const BASE = 393_000;

describe("sensibilidade-derive — paramLabel", () => {
  it("traduz parameter conhecido", () => {
    expect(paramLabel("monthly_rent")).toBe("Aluguel mensal (±20%)");
    expect(paramLabel("vacancy_months_per_year")).toBe("Vacância (0–3 meses)");
  });

  it("retorna parameter cru para chave desconhecida (fallback)", () => {
    expect(paramLabel("foo_bar")).toBe("foo_bar");
  });

  it("PARAMETER_LABELS cobre os 6 parâmetros padrão do backend", () => {
    expect(Object.keys(PARAMETER_LABELS).sort()).toEqual([
      "annual_appreciation",
      "income_tax_bracket",
      "iptu_rate",
      "management_fee_pct",
      "monthly_rent",
      "vacancy_months_per_year",
    ]);
  });
});

describe("sensibilidade-derive — enrichRows", () => {
  it("calcula impactos e amplitude corretamente", () => {
    const enriched = enrichRows(SAMPLE.slice(0, 1), BASE);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      parameter: "monthly_rent",
      label: "Aluguel mensal (±20%)",
      pessimistic: 320_000,
      optimistic: 470_000,
      base: 393_000,
      pessImpact: 320_000 - 393_000,
      optImpact: 470_000 - 393_000,
      amplitude: 470_000 - 320_000,
    });
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
      "monthly_rent",
      "annual_appreciation",
      "vacancy_months_per_year",
      "management_fee_pct",
      "iptu_rate",
      "income_tax_bracket",
    ]);
    expect(enriched[0].parameter).toBe("monthly_rent");
  });
});

describe("sensibilidade-derive — tornadoBounds", () => {
  it("retorna range simétrico em torno do base", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    const { min, max } = tornadoBounds(enriched, BASE);
    // maior |impact| em SAMPLE: monthly_rent.optImpact = 470k - 393k = 77k
    // padded = 77k × 1,05 = 80_850
    expect(min).toBeCloseTo(BASE - 80_850, -1);
    expect(max).toBeCloseTo(BASE + 80_850, -1);
    expect(BASE - min).toBeCloseTo(max - BASE, 0);
  });

  it("array vazio → fallback ±10% do base", () => {
    expect(tornadoBounds([], 100_000)).toEqual({ min: 90_000, max: 110_000 });
  });
});
