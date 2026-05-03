import type { SensitivityRowOut } from "./api-types";

export const PARAMETER_LABELS: Record<string, string> = {
  monthly_rent:            "Aluguel mensal (±20%)",
  annual_appreciation:     "Valorização (±3pp)",
  vacancy_months_per_year: "Vacância (0–3 meses)",
  management_fee_pct:      "Adm. imobiliária (0–15%)",
  iptu_rate:               "IPTU (0,5–2%)",
  income_tax_bracket:      "Faixa IR (0–27,5%)",
};

export function paramLabel(parameter: string): string {
  return PARAMETER_LABELS[parameter] ?? parameter;
}

export type SensitivityRow = {
  parameter: string;
  label: string;
  pessimistic: number;
  optimistic: number;
  base: number;
  pessImpact: number;
  optImpact: number;
  amplitude: number;
};

export function enrichRows(
  rows: SensitivityRowOut[],
  base: number,
): SensitivityRow[] {
  return rows.map((r) => ({
    parameter:   r.parameter,
    label:       paramLabel(r.parameter),
    pessimistic: r.pessimistic,
    optimistic:  r.optimistic,
    base,
    pessImpact:  r.pessimistic - base,
    optImpact:   r.optimistic - base,
    amplitude:   Math.abs(r.optimistic - r.pessimistic),
  }));
}

export function sortByImpact(rows: SensitivityRow[]): SensitivityRow[] {
  return [...rows].sort((a, b) => b.amplitude - a.amplitude);
}

export function tornadoBounds(
  rows: SensitivityRow[],
  base: number,
): { min: number; max: number } {
  if (rows.length === 0) {
    return {
      min: Math.round(base * 0.9 * 100) / 100,
      max: Math.round(base * 1.1 * 100) / 100,
    };
  }
  // Use both impact magnitudes — otherwise an optimistic bar may extend past
  // the chart's right edge when |optImpact| > |pessImpact|.
  const maxDeviation = Math.max(
    ...rows.map((r) => Math.max(Math.abs(r.pessImpact), Math.abs(r.optImpact))),
  );
  const padded = maxDeviation * 1.05;
  return { min: base - padded, max: base + padded };
}
