import { describe, it, expect } from "vitest";
import { exportCsv, importCsv } from "@/lib/ativos-csv";
import type { AssetPosition } from "@/lib/ativos-schema";

const samplePosition: AssetPosition = {
  id: "1",
  ticker: "HGCR11",
  assetClass: "FII_PAPEL",
  currency: "BRL",
  quantity: 100,
  avgPrice: 100,
  expectedYield: 0.13,
  capitalGain: 0,
  color: "#FFC857",
};

function fileFromString(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("ativos-csv — exportCsv", () => {
  it("retorna BOM utf-8-sig + header pt-BR + 7 colunas separadas por ;", () => {
    const csv = exportCsv([samplePosition]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital");
    expect(lines[1].split(";")).toHaveLength(7);
  });

  it("decimais com vírgula", () => {
    const csv = exportCsv([{ ...samplePosition, avgPrice: 100.50, expectedYield: 0.1234 }]);
    const lines = csv.slice(1).split("\r\n");
    const cells = lines[1].split(";");
    expect(cells[4]).toBe("100,50");        // avgPrice toFixed(2)
    expect(cells[5]).toBe("0,1234");        // yield toFixed(4)
  });
});

describe("ativos-csv — importCsv", () => {
  it("round-trip do que exportCsv produziu", async () => {
    const csv = exportCsv([samplePosition]);
    const result = await importCsv(fileFromString(csv));
    expect(result.errors).toHaveLength(0);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].ticker).toBe("HGCR11");
    expect(result.positions[0].assetClass).toBe("FII_PAPEL");
    expect(result.positions[0].avgPrice).toBe(100);
  });

  it("classe inválida → erro na linha", async () => {
    const csv =
      "﻿Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital\r\n" +
      "FOO;Cripto;BRL;100;10,00;0,05;0\r\n";
    const result = await importCsv(fileFromString(csv));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.positions).toHaveLength(0);
  });

  it("quantidade negativa → erro na linha", async () => {
    const csv =
      "﻿Ticker;Classe;Moeda;Quantidade;Preço Médio;Yield Esperado;Ganho Capital\r\n" +
      "HGCR11;FII de Papel;BRL;-10;100,00;0,13;0\r\n";
    const result = await importCsv(fileFromString(csv));
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("arquivo vazio → empty result", async () => {
    const result = await importCsv(fileFromString(""));
    expect(result.positions).toHaveLength(0);
  });

  it("cabeçalho ausente → erros", async () => {
    const csv = "﻿HGCR11;FII de Papel;BRL;100;100,00;0,13;0\r\n";
    const result = await importCsv(fileFromString(csv));
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
