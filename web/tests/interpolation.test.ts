import { describe, it, expect } from "vitest";
import { interpolateMonthly } from "@/lib/interpolation";

describe("interpolateMonthly", () => {
  it("retorna 13 pontos pra um ano de dados (Y0, Y1)", () => {
    const out = interpolateMonthly([100, 110]);
    expect(out).toHaveLength(13);
  });

  it("preserva endpoints: M0 === Y0 e M12 === Y1", () => {
    const out = interpolateMonthly([100, 110]);
    expect(out[0]).toBe(100);
    expect(out[12]).toBeCloseTo(110, 8);
  });

  it("interpola geometricamente quando os endpoints são positivos", () => {
    const out = interpolateMonthly([100, 121]);
    // M6 deve ser ~110 (geometric mean), não 110.5 (linear midpoint)
    expect(out[6]).toBeCloseTo(110, 5);
  });

  it("usa linear quando Y0 == 0 (evita divisão por zero geométrica)", () => {
    const out = interpolateMonthly([0, 12]);
    expect(out[0]).toBe(0);
    expect(out[6]).toBeCloseTo(6, 5);
    expect(out[12]).toBeCloseTo(12, 5);
  });

  it("encadeia múltiplos anos preservando todos os pontos anuais nos índices i*12", () => {
    const out = interpolateMonthly([100, 110, 121]);
    expect(out).toHaveLength(25);
    expect(out[0]).toBe(100);
    expect(out[12]).toBeCloseTo(110, 5);
    expect(out[24]).toBeCloseTo(121, 5);
  });

  it("array vazio retorna vazio; um ponto retorna ele mesmo", () => {
    expect(interpolateMonthly([])).toEqual([]);
    expect(interpolateMonthly([42])).toEqual([42]);
  });
});
