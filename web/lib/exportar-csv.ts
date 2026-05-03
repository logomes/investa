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
  append(sim.realEstate);
  append(sim.portfolio);
  append(sim.benchmark);
  return result;
}

// `,` as decimal separator. `.toString()` preserves precision (no fixed
// rounding); `replace` swaps the dot. Integers ("1000") pass through unchanged.
function formatBR(value: number): string {
  return value.toString().replace(".", ",");
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
  return `simulacao_imovel_vs_carteira_${horizonYears}anos.csv`;
}
