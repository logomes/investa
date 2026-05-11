import { describe, it, expect } from "vitest";
import {
  parseB3Position, isB3PositionHeader,
  parseB3Movements, isB3MovementsHeader,
  parseB3Negociacao, isB3NegociacaoHeader,
  parseB3Events, isB3EventsHeader, aggregateScheduledIncome,
  computeAverageCost,
} from "@/lib/b3-import";

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

  it("Tipo='FII' explicito refina pra FII", () => {
    const rows: (string | number | null)[][] = [
      HEADER,
      ["HGCR11 FII", "BTG", "1", "HGCR11", "111", "BR", "FII", "BTG", 50, 50, "-", "-", "98,30", "4915"],
    ];
    const result = parseB3Position(rows);
    expect(result.positions[0]?.assetClass).toBe("FII");
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

const EVENTS_HEADER = [
  "Produto", "Tipo", "Tipo de Evento", "Previsão de pagamento",
  "Instituição", "Conta", "Quantidade", "Preço unitário", "Valor líquido",
];

describe("parseB3Events", () => {
  it("isB3EventsHeader reconhece o cabeçalho de Eventos", () => {
    expect(isB3EventsHeader(EVENTS_HEADER)).toBe(true);
    expect(isB3EventsHeader(HEADER)).toBe(false);
    expect(isB3EventsHeader(MOV_HEADER)).toBe(false);
  });

  it("parseia eventos de RENDIMENTO/DIVIDENDO/JCP com valores e datas BR", () => {
    const rows: (string | number | null)[][] = [
      EVENTS_HEADER,
      ["KNCA11 - KINEA", "Fundo", "RENDIMENTO", "14/05/2026", "BTG", "5864332", 157, "1,1", "172,7"],
      ["VALE3 - VALE", "Renda Variável", "DIVIDENDO", "20/05/2026", "BTG", "5864332", 48, "0,5", 24],
      ["B3SA3 - B3", "Renda Variável", "JUROS SOBRE CAPITAL PRÓPRIO", "25/05/2026", "BTG", "5864332", 179, "0,1", "17,9"],
    ];
    const result = parseB3Events(rows);
    expect(result.errors).toEqual([]);
    expect(result.events.length).toBe(3);

    const knca = result.events.find((e) => e.ticker === "KNCA11");
    expect(knca?.type).toBe("RENDIMENTO");
    expect(knca?.paymentDate).toBe("2026-05-14");
    expect(knca?.netValue).toBe(172.7);
  });

  it("aggregateScheduledIncome soma por ticker", () => {
    const events = [
      { ticker: "X", type: "RENDIMENTO", paymentDate: "2026-05-14", quantity: 100, unitPrice: 1, netValue: 100 },
      { ticker: "X", type: "RENDIMENTO", paymentDate: "2026-06-14", quantity: 100, unitPrice: 0.5, netValue: 50 },
      { ticker: "Y", type: "DIVIDENDO", paymentDate: "2026-05-20", quantity: 50, unitPrice: 0.5, netValue: 25 },
    ];
    const result = aggregateScheduledIncome(events);
    expect(result.get("X")).toBe(150);
    expect(result.get("Y")).toBe(25);
  });

  it("ignora linhas sem ticker reconhecível", () => {
    const rows: (string | number | null)[][] = [
      EVENTS_HEADER,
      ["", "Fundo", "RENDIMENTO", "14/05/2026", "BTG", "5864332", 100, "1", "100"],
      [null, "Fundo", "RENDIMENTO", "14/05/2026", "BTG", "5864332", 100, "1", "100"],
    ];
    const result = parseB3Events(rows);
    expect(result.events).toEqual([]);
  });
});

const NEGOCIACAO_HEADER = [
  "Data do Negócio", "Tipo de Movimentação", "Mercado", "Prazo/Vencimento",
  "Instituição", "Código de Negociação", "Quantidade", "Preço", "Valor",
];

describe("parseB3Negociacao", () => {
  it("isB3NegociacaoHeader reconhece o cabeçalho", () => {
    expect(isB3NegociacaoHeader(NEGOCIACAO_HEADER)).toBe(true);
    expect(isB3NegociacaoHeader(MOV_HEADER)).toBe(false);
  });

  it("Compra → buy, Venda → sell, e suffix F é normalizado", () => {
    const rows: (string | number | null)[][] = [
      NEGOCIACAO_HEADER,
      ["08/05/2026", "Compra", "Mercado Fracionário", "-", "BTG", "BBDC3F", 40, "16,18", "647,2"],
      ["06/05/2026", "Venda", "Mercado à Vista", "-", "BTG", "BBDC4", 100, "19,29", 1929],
      ["08/05/2026", "Compra", "Mercado Fracionário", "-", "BTG", "TAEE11F", 30, "41,25", "1237,5"],
    ];
    const result = parseB3Negociacao(rows);
    expect(result.errors).toEqual([]);
    expect(result.trades.length).toBe(3);
    expect(result.trades.find((t) => t.ticker === "BBDC3")?.side).toBe("buy");
    expect(result.trades.find((t) => t.ticker === "BBDC4")?.side).toBe("sell");
    expect(result.trades.find((t) => t.ticker === "TAEE11")?.quantity).toBe(30);
  });

  it("BBDC3 e BBDC3F agregam no mesmo ticker pelo computeAverageCost", () => {
    const rows: (string | number | null)[][] = [
      NEGOCIACAO_HEADER,
      ["01/01/2026", "Compra", "Mercado à Vista", "-", "BTG", "BBDC3", 100, "15,00", "1500"],
      ["02/01/2026", "Compra", "Mercado Fracionário", "-", "BTG", "BBDC3F", 50, "20,00", "1000"],
    ];
    const result = parseB3Negociacao(rows);
    const avgs = computeAverageCost(result.trades);
    // 100*15 + 50*20 = 1500 + 1000 = 2500 / 150 = 16.6667
    expect(avgs.get("BBDC3")).toBeCloseTo(16.667, 2);
    expect(avgs.has("BBDC3F")).toBe(false);
  });

  it("reporta earliestDate / latestDate corretos", () => {
    const rows: (string | number | null)[][] = [
      NEGOCIACAO_HEADER,
      ["10/01/2026", "Compra", "Vista", "-", "BTG", "X3", 1, "10", "10"],
      ["05/05/2026", "Compra", "Vista", "-", "BTG", "X3", 1, "20", "20"],
    ];
    const result = parseB3Negociacao(rows);
    expect(result.earliestDate).toBe("2026-01-10");
    expect(result.latestDate).toBe("2026-05-05");
  });
});
