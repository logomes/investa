import { describe, it, expect } from "vitest";
import { comparePrevidencia, previdenciaRate } from "@/lib/previdencia";

describe("previdenciaRate (regressiva de previdência, tabela longa)", () => {
  it("pins the Brazilian table per holding year", () => {
    expect(previdenciaRate(1)).toBe(0.35);
    expect(previdenciaRate(2)).toBe(0.35);
    expect(previdenciaRate(3)).toBe(0.3);
    expect(previdenciaRate(4)).toBe(0.3);
    expect(previdenciaRate(5)).toBe(0.25);
    expect(previdenciaRate(6)).toBe(0.25);
    expect(previdenciaRate(7)).toBe(0.2);
    expect(previdenciaRate(8)).toBe(0.2);
    expect(previdenciaRate(9)).toBe(0.15);
    expect(previdenciaRate(10)).toBe(0.15);
    expect(previdenciaRate(11)).toBe(0.1);
    expect(previdenciaRate(12)).toBe(0.1);
  });

  it("floors at 10% for very long holds", () => {
    expect(previdenciaRate(20)).toBe(0.1);
  });
});

describe("comparePrevidencia", () => {
  it("deductionUsedAnnual caps at 12% da renda", () => {
    const r = comparePrevidencia({
      rendaTributavelAnual: 100000,
      aporteAnual: 30000,
      aliquotaMarginal: 0.275,
      taxaRetorno: 0.08,
      horizonYears: 5,
    });
    expect(r.deductionUsedAnnual).toBe(12000);
  });

  it("does not cap when aporte is below 12% da renda", () => {
    const r = comparePrevidencia({
      rendaTributavelAnual: 100000,
      aporteAnual: 8000,
      aliquotaMarginal: 0.275,
      taxaRetorno: 0.08,
      horizonYears: 5,
    });
    expect(r.deductionUsedAnnual).toBe(8000);
  });

  it("PGBL wins for high earners over a long horizon (marginal 27,5%, h=12, 8%)", () => {
    const r = comparePrevidencia({
      rendaTributavelAnual: 200000,
      aporteAnual: 24000, // = 12% da renda, fully deductible
      aliquotaMarginal: 0.275,
      taxaRetorno: 0.08,
      horizonYears: 12,
    });
    expect(r.diff).toBeGreaterThan(0);
    expect(r.diff).toBeCloseTo(r.netPgbl - r.netVgbl, 6);
  });

  it("VGBL wins for low earners over a short horizon (marginal 7,5%, h=4, 8%)", () => {
    const r = comparePrevidencia({
      rendaTributavelAnual: 60000,
      aporteAnual: 7200, // = 12% da renda
      aliquotaMarginal: 0.075,
      taxaRetorno: 0.08,
      horizonYears: 4,
    });
    expect(r.diff).toBeLessThanOrEqual(0);
    expect(r.netVgbl).toBeGreaterThanOrEqual(r.netPgbl);
  });

  it("taxes PGBL on total vs VGBL on gain only (single year, hand-computed)", () => {
    // h=1: single tranche held 1 year → previdenciaRate(1) = 0.35.
    const renda = 100000;
    const aporte = 10000; // < 12% (12000), so deductionUsed = 10000
    const aliquota = 0.275;
    const r = 0.08;
    const res = comparePrevidencia({
      rendaTributavelAnual: renda,
      aporteAnual: aporte,
      aliquotaMarginal: aliquota,
      taxaRetorno: r,
      horizonYears: 1,
    });

    expect(res.deductionUsedAnnual).toBe(10000);

    // PGBL: invest aporte + (deduction * aliquota) = 10000 + 10000*0.275 = 12750.
    const contribPgbl = aporte + 10000 * aliquota; // 12750
    const valuePgbl = contribPgbl * (1 + r); // grows 1 year
    const taxPgbl = 0.35 * valuePgbl; // taxes TOTAL
    const netPgbl = valuePgbl - taxPgbl;
    expect(res.netPgbl).toBeCloseTo(netPgbl, 6);

    // VGBL: invest aporte only.
    const valueVgbl = aporte * (1 + r);
    const gainVgbl = valueVgbl - aporte;
    const taxVgbl = 0.35 * gainVgbl; // taxes GAIN only
    const netVgbl = valueVgbl - taxVgbl;
    expect(res.netVgbl).toBeCloseTo(netVgbl, 6);
  });
});
