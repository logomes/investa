import { describe, it, expect } from "vitest";
import { parseB3PaidProvents } from "@/lib/b3-import";

const HEADER = ["Entrada/Saída", "Data", "Movimentação", "Produto", "Instituição", "Quantidade", "Preço unitário", "Valor da Operação"];

describe("parseB3PaidProvents", () => {
  it("extrai Rendimento/Dividendo/JCP da Movimentação", () => {
    const rows = [
      HEADER,
      ["Credito", "15/03/2026", "Rendimento", "HGCR11 - CSHG RECEBIVEIS", "XP", "100", "1,20", "120,00"],
      ["Credito", "20/03/2026", "Dividendo", "PETR4 - PETROLEO BRASILEIRO", "XP", "200", "0,50", "100,00"],
      ["Credito", "25/03/2026", "Juros Sobre Capital Próprio", "ITUB4 - ITAU UNIBANCO", "XP", "300", "0,30", "90,00"],
      ["Credito", "10/02/2026", "Transferência - Liquidação", "VALE3 - VALE", "XP", "100", "60,00", "6000,00"],
    ];
    const r = parseB3PaidProvents(rows);
    expect(r.errors).toHaveLength(0);
    expect(r.provents).toHaveLength(3);
    expect(r.provents[0]).toEqual({ ticker: "HGCR11", type: "Rendimento", paidDate: "2026-03-15", netValue: 120 });
    expect(r.provents[1]).toEqual({ ticker: "PETR4", type: "Dividendo", paidDate: "2026-03-20", netValue: 100 });
    expect(r.provents[2]).toEqual({ ticker: "ITUB4", type: "Juros Sobre Capital Próprio", paidDate: "2026-03-25", netValue: 90 });
  });

  it("fallback pra qty × price quando Valor da Operação ausente/zero", () => {
    const rows = [
      HEADER,
      ["Credito", "15/03/2026", "Rendimento", "HGCR11 - CSHG", "XP", "100", "1,20", ""],
      ["Credito", "16/03/2026", "Rendimento", "MXRF11 - MAXI", "XP", "200", "0,50", "-"],
    ];
    const r = parseB3PaidProvents(rows);
    expect(r.provents).toHaveLength(2);
    expect(r.provents[0].netValue).toBeCloseTo(120);
    expect(r.provents[1].netValue).toBeCloseTo(100);
  });

  it("aceita Reembolso (cash que entrou na conta)", () => {
    const rows = [
      HEADER,
      ["Credito", "01/04/2026", "Reembolso - Bonificação", "TAEE11 - TAESA", "XP", "0", "0", "12,34"],
    ];
    const r = parseB3PaidProvents(rows);
    expect(r.provents).toHaveLength(1);
    expect(r.provents[0].netValue).toBeCloseTo(12.34);
  });

  it("ignora linhas sem valor monetário válido", () => {
    const rows = [
      HEADER,
      ["Credito", "15/03/2026", "Rendimento", "HGCR11 - CSHG", "XP", "0", "0", "0"],
    ];
    const r = parseB3PaidProvents(rows);
    expect(r.provents).toHaveLength(0);
  });

  it("erro em data inválida", () => {
    const rows = [
      HEADER,
      ["Credito", "lixo", "Rendimento", "HGCR11 - CSHG", "XP", "100", "1,20", "120,00"],
    ];
    const r = parseB3PaidProvents(rows);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("data inválida");
  });

  it("recusa cabeçalho que não corresponde", () => {
    const rows = [["foo", "bar"]];
    const r = parseB3PaidProvents(rows);
    expect(r.errors[0].message).toContain("cabeçalho não corresponde");
  });

  it("arquivo vazio", () => {
    const r = parseB3PaidProvents([]);
    expect(r.errors[0].message).toBe("arquivo vazio");
  });
});
