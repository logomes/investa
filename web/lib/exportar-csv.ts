import type { SimulateOut, SimulationResultOut } from "./api-types";

export type LongRow = {
  scenario: string;
  year: number;
  patrimony: number;
  annualIncome: number;
  cumulativeIncome: number;
};

export function buildLongFormatRows(sim: SimulateOut): LongRow[] {
  const result: LongRow[] = [];
  const append = (r: SimulationResultOut) => {
    for (let i = 0; i < r.years.length; i++) {
      result.push({
        scenario: r.label,
        year: r.years[i],
        patrimony: r.patrimony[i],
        annualIncome: r.annualIncome[i],
        cumulativeIncome: r.cumulativeIncome[i],
      });
    }
  };
  append(sim.portfolio);
  append(sim.benchmark);
  return result;
}

// `,` as decimal separator. Round monetary values to 2 places (cents) to avoid
// the long binary-float tail (e.g. 277933.2143036685) leaking into the CSV.
// Excel BR opens this directly as currency.
function formatBR(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function toCsvBR(rows: LongRow[]): string {
  const BOM = "﻿";
  const header = "Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada";
  const body = rows.map((r) =>
    [
      r.scenario,
      r.year.toString(),
      formatBR(r.patrimony),
      formatBR(r.annualIncome),
      formatBR(r.cumulativeIncome),
    ].join(";"),
  );
  return BOM + [header, ...body].join("\r\n") + "\r\n";
}

export function csvFilename(horizonYears: number): string {
  return `simulacao_investa_${horizonYears}anos.csv`;
}
