import { describe, it, expect } from "vitest";
import { parseB3Position, isB3PositionHeader, parseB3Movements, isB3MovementsHeader, computeAverageCost } from "@/lib/b3-import";

const HEADER = [
  "Produto", "Instituição", "Conta", "Código de Negociação", "CNPJ da Empresa",
  "Código ISIN / Distribuição", "Tipo", "Escriturador", "Quantidade",
  "Quantidade Disponível", "Quantidade Indisponível", "Motivo",
  "Preço de Fechamento", "Valor Atualizado",
];

const SAMPLE: (string | number | null)[][] = [
  HEADER,
  // PETR4 across two brokers — should aggregate
  ["PETR4 - PETROLEO", "BANCO BTG PACTUAL S/A", "5864332", "PETR4", "33000167000101", "BRPETRACNPR6", "PN", "BANCO BRADESCO S/A", 161, 161, "-", "-", "45,67", "7352,87"],
  ["PETR4 - PETROLEO", "NU INVESTIMENTOS S.A. - CTVM", "3994207", "PETR4", "33000167000101", "BRPETRACNPR6", "PN", "BANCO BRADESCO S/A", 18, 18, "-", "-", "45,67", "822,06"],
  // VALE3 single broker
  ["VALE3 - VALE", "BANCO BTG PACTUAL S/A", "5864332", "VALE3", "33592510000154", "BRVALEACNOR0", "ON", "BANCO BRADESCO S/A", 48, 48, "-", "-", "81,49", "3911,52"],
  // TAEE11 (UNIT) — should still classify as ACAO via pattern (TAEE11 is a unit, but pattern *11 → FII default; tipo=UNIT could refine but we keep simple)
  ["TAEE11 - TRANSMISSORA", "BANCO BTG PACTUAL S/A", "5864332", "TAEE11", "07859971000130", "BRTAEECDAM10", "UNIT", "BTG PACTUAL", 125, 125, "-", "-", "40,96", 5120],
  // Footer rows
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, "Total"],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, "86590,25"],
];

describe("parseB3Position", () => {
  it("isB3PositionHeader reconhece o cabeçalho B3", () => {
    expect(isB3PositionHeader(HEADER)).toBe(true);
    expect(isB3PositionHeader(["foo", "bar"])).toBe(false);
  });

  it("agrega quantidades de mesmo ticker em brokers diferentes", () => {
    const result = parseB3Position(SAMPLE);
    expect(result.errors).toEqual([]);
    const petr4 = result.positions.find((p) => p.ticker === "PETR4");
    expect(petr4?.quantity).toBe(179); // 161 + 18
    expect(petr4?.closingPrice).toBe(45.67);
  });

  it("classifica por padrão de ticker via inferAssetClass", () => {
    const result = parseB3Position(SAMPLE);
    const petr4 = result.positions.find((p) => p.ticker === "PETR4");
    const vale3 = result.positions.find((p) => p.ticker === "VALE3");
    expect(petr4?.assetClass).toBe("ACAO_BR_DIVIDENDO");
    expect(vale3?.assetClass).toBe("ACAO_BR_DIVIDENDO");
  });

  it("Tipo='FII' explicito refina pra FII_PAPEL", () => {
    const rows: (string | number | null)[][] = [
      HEADER,
      ["HGCR11 FII", "BTG", "1", "HGCR11", "111", "BR", "FII", "BTG", 50, 50, "-", "-", "98,30", "4915"],
    ];
    const result = parseB3Position(rows);
    expect(result.positions[0]?.assetClass).toBe("FII_PAPEL");
  });

  it("Tipo='ETF' explicito refina pra ETF_BR", () => {
    const rows: (string | number | null)[][] = [
      HEADER,
      ["BOVA11 ETF", "BTG", "1", "BOVA11", "111", "BR", "ETF", "BTG", 100, 100, "-", "-", "120,5", "12050"],
    ];
    const result = parseB3Position(rows);
    expect(result.positions[0]?.assetClass).toBe("ETF_BR");
  });

  it("preço BR-format ('45,67' ou string com ponto e vírgula) parsed corretamente", () => {
    const rows: (string | number | null)[][] = [
      HEADER,
      ["X", "BTG", "1", "TEST3", "111", "BR", "ON", "BTG", "1.000", "1.000", "-", "-", "1.234,56", "1234560"],
    ];
    const result = parseB3Position(rows);
    expect(result.positions[0]?.quantity).toBe(1000);
    expect(result.positions[0]?.closingPrice).toBe(1234.56);
  });

  it("ignora rodapé de Total e linhas vazias sem erros", () => {
    const result = parseB3Position(SAMPLE);
    expect(result.errors).toEqual([]);
    expect(result.positions.length).toBe(3); // PETR4 (agregado), VALE3, TAEE11
  });

  it("coleta brokers distintos pra o resumo", () => {
    const result = parseB3Position(SAMPLE);
    expect(result.brokers).toContain("BANCO BTG PACTUAL S/A");
    expect(result.brokers).toContain("NU INVESTIMENTOS S.A. - CTVM");
  });

  it("cabeçalho inválido retorna erro estruturado", () => {
    const result = parseB3Position([["foo", "bar"]]);
    expect(result.positions).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/cabeçalho/i);
  });

  it("arquivo vazio retorna erro", () => {
    const result = parseB3Position([]);
    expect(result.errors[0]?.message).toMatch(/vazio/);
  });
});

const MOV_HEADER = [
  "Entrada/Saída", "Data", "Movimentação", "Produto", "Instituição",
  "Quantidade", "Preço unitário", "Valor da Operação",
];

describe("parseB3Movements", () => {
  it("isB3MovementsHeader reconhece o cabeçalho", () => {
    expect(isB3MovementsHeader(MOV_HEADER)).toBe(true);
    expect(isB3MovementsHeader(HEADER)).toBe(false);
  });

  it("filtra somente Transferência - Liquidação com preço > 0", () => {
    const rows: (string | number | null)[][] = [
      MOV_HEADER,
      ["Credito", "06/05/2026", "Transferência - Liquidação", "ISAE3 - CTEEP", "BTG", 20, "34,52", "690,4"],
      ["Credito", "08/05/2026", "Juros Sobre Capital Próprio", "POMO3 - MARCOPOLO", "BTG", 804, "0,085", "56,39"],
      ["Credito", "07/05/2026", "Empréstimo", "EGIE3", "BTG", 79, "-", "-"],
    ];
    const result = parseB3Movements(rows);
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].ticker).toBe("ISAE3");
    expect(result.trades[0].side).toBe("buy");
    expect(result.trades[0].price).toBe(34.52);
  });

  it("Debito é mapeado pra sell, Credito pra buy", () => {
    const rows: (string | number | null)[][] = [
      MOV_HEADER,
      ["Debito", "08/05/2026", "Transferência - Liquidação", "BAZA3", "BTG", 82, "83,83", "6874,06"],
      ["Credito", "06/05/2026", "Transferência - Liquidação", "ISAE3", "BTG", 20, "34,52", "690,4"],
    ];
    const result = parseB3Movements(rows);
    expect(result.trades.find((t) => t.ticker === "BAZA3")?.side).toBe("sell");
    expect(result.trades.find((t) => t.ticker === "ISAE3")?.side).toBe("buy");
  });

  it("converte data BR (DD/MM/YYYY) pra ISO (YYYY-MM-DD)", () => {
    const rows: (string | number | null)[][] = [
      MOV_HEADER,
      ["Credito", "06/05/2026", "Transferência - Liquidação", "ISAE3", "BTG", 20, "34,52", "690,4"],
    ];
    const result = parseB3Movements(rows);
    expect(result.trades[0].date).toBe("2026-05-06");
  });

  it("reporta earliestDate e latestDate corretos", () => {
    const rows: (string | number | null)[][] = [
      MOV_HEADER,
      ["Credito", "10/01/2026", "Transferência - Liquidação", "X3", "BTG", 1, "10", "10"],
      ["Credito", "20/03/2026", "Transferência - Liquidação", "Y3", "BTG", 1, "20", "20"],
      ["Credito", "05/05/2026", "Transferência - Liquidação", "Z3", "BTG", 1, "30", "30"],
    ];
    const result = parseB3Movements(rows);
    expect(result.earliestDate).toBe("2026-01-10");
    expect(result.latestDate).toBe("2026-05-05");
  });
});

describe("computeAverageCost", () => {
  it("buy só → avg = price", () => {
    const result = computeAverageCost([
      { ticker: "X", side: "buy", quantity: 100, price: 10, date: "2026-01-01" },
    ]);
    expect(result.get("X")).toBeCloseTo(10, 5);
  });

  it("dois buys ponderados", () => {
    const result = computeAverageCost([
      { ticker: "X", side: "buy", quantity: 100, price: 10, date: "2026-01-01" },
      { ticker: "X", side: "buy", quantity: 100, price: 20, date: "2026-02-01" },
    ]);
    // (100*10 + 100*20) / 200 = 15
    expect(result.get("X")).toBeCloseTo(15, 5);
  });

  it("sell entre buys preserva avg fiscal brasileiro (não recalcula)", () => {
    const result = computeAverageCost([
      { ticker: "X", side: "buy", quantity: 100, price: 10, date: "2026-01-01" },  // avg=10, qty=100
      { ticker: "X", side: "sell", quantity: 50, price: 12, date: "2026-02-01" }, // avg=10, qty=50
      { ticker: "X", side: "buy", quantity: 100, price: 20, date: "2026-03-01" }, // avg = (50*10 + 100*20) / 150 = 16.67
    ]);
    expect(result.get("X")).toBeCloseTo(16.667, 2);
  });

  it("zera avg quando posição vai a zero", () => {
    const result = computeAverageCost([
      { ticker: "X", side: "buy", quantity: 100, price: 10, date: "2026-01-01" },
      { ticker: "X", side: "sell", quantity: 100, price: 12, date: "2026-02-01" },
    ]);
    expect(result.get("X")).toBeUndefined();
  });

  it("cronologia respeitada mesmo com input fora de ordem", () => {
    const result = computeAverageCost([
      { ticker: "X", side: "buy", quantity: 100, price: 20, date: "2026-03-01" },
      { ticker: "X", side: "buy", quantity: 100, price: 10, date: "2026-01-01" },
    ]);
    // After sort: jan → buy 100@10, mar → buy 100@20 → avg = 15
    expect(result.get("X")).toBeCloseTo(15, 5);
  });
});
