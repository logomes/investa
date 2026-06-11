import { describe, it, expect } from "vitest";
import {
  buildLongFormatRows,
  toCsvBR,
  csvFilename,
  type LongRow,
} from "@/lib/exportar-csv";
import type { SimulateOut } from "@/lib/api-types";

const SIM: SimulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2],
    patrimony: [230_000, 260_000, 290_000],
    annualIncome: [0, 9_000, 9_500],
    cumulativeIncome: [0, 9_000, 18_500],
    debtBalance: null,
    internalPortfolio: null,
  },
  portfolio: {
    label: "Carteira Diversificada",
    color: "#27AE60",
    years: [0, 1, 2],
    patrimony: [230_000, 250_000, 275_000],
    annualIncome: [0, 14_794, 15_500],
    cumulativeIncome: [0, 14_794, 30_294],
    debtBalance: null,
    internalPortfolio: null,
  },
  benchmark: {
    label: "CDI (líquido)",
    color: "#5CC8FF",
    years: [0, 1, 2],
    patrimony: [230_000, 258_000, 289_000],
    annualIncome: [0, 28_000, 31_000],
    cumulativeIncome: [0, 28_000, 59_000],
    debtBalance: null,
    internalPortfolio: null,
  },
  sensitivity: [],
  taxComparison: [],
};

describe("exportar-csv — buildLongFormatRows", () => {
  it("retorna 2 × years.length linhas (portfolio + benchmark, sem realEstate)", () => {
    const rows = buildLongFormatRows(SIM);
    expect(rows).toHaveLength(6);
  });

  it("ordem fixa: portfolio → benchmark; realEstate NÃO aparece", () => {
    const rows = buildLongFormatRows(SIM);
    const scenarios = rows.map((r) => r.scenario);
    expect(scenarios).not.toContain("Imóvel");
    expect(rows[0].scenario).toBe("Carteira Diversificada");
    expect(rows[2].scenario).toBe("Carteira Diversificada");
    expect(rows[3].scenario).toBe("CDI (líquido)");
    expect(rows[5].scenario).toBe("CDI (líquido)");
  });

  it("cada row tem ano + 4 colunas numéricas", () => {
    const rows = buildLongFormatRows(SIM);
    const first = rows[0];
    expect(first.year).toBe(0);
    expect(first.patrimony).toBe(230_000);
    expect(first.annualIncome).toBe(0);
    expect(first.cumulativeIncome).toBe(0);
  });

  it("preserva a ordem dos anos dentro de cada cenário", () => {
    const rows = buildLongFormatRows(SIM);
    expect(rows[0].year).toBe(0);
    expect(rows[1].year).toBe(1);
    expect(rows[2].year).toBe(2);
  });
});

describe("exportar-csv — toCsvBR", () => {
  it("começa com BOM utf-8-sig (\\uFEFF)", () => {
    const csv = toCsvBR([]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it("primeira linha após BOM é o header pt-BR", () => {
    const csv = toCsvBR([]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada");
  });

  it("usa ';' como separador (5 colunas → 4 separadores por linha)", () => {
    const row: LongRow = {
      scenario: "Imóvel",
      year: 0,
      patrimony: 230_000,
      annualIncome: 0,
      cumulativeIncome: 0,
    };
    const csv = toCsvBR([row]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1].split(";")).toHaveLength(5);
  });

  it("decimais com vírgula, arredondados a 2 casas (centavos)", () => {
    const row: LongRow = {
      scenario: "X",
      year: 0,
      patrimony: 277933.2143036685,    // long float tail truncated → "277933,21"
      annualIncome: 9.5,                // padded to 2 places → "9,50"
      cumulativeIncome: 0.001,          // rounded down → "0,00"
    };
    const csv = toCsvBR([row]);
    const lines = csv.slice(1).split("\r\n");
    const cells = lines[1].split(";");
    expect(cells[2]).toBe("277933,21");
    expect(cells[3]).toBe("9,50");
    expect(cells[4]).toBe("0,00");
  });

  it("linhas separadas por \\r\\n", () => {
    const row: LongRow = {
      scenario: "X",
      year: 0,
      patrimony: 1,
      annualIncome: 2,
      cumulativeIncome: 3,
    };
    const csv = toCsvBR([row, row]);
    expect(csv.includes("\r\n")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("array vazio retorna BOM + header + \\r\\n", () => {
    const csv = toCsvBR([]);
    expect(csv).toBe("﻿Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada\r\n");
  });
});

describe("exportar-csv — csvFilename", () => {
  it("formato 'simulacao_investa_{N}anos.csv'", () => {
    expect(csvFilename(10)).toBe("simulacao_investa_10anos.csv");
    expect(csvFilename(1)).toBe("simulacao_investa_1anos.csv");
    expect(csvFilename(30)).toBe("simulacao_investa_30anos.csv");
  });
});
