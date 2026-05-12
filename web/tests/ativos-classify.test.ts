import { describe, it, expect } from "vitest";
import { inferAssetClass } from "@/lib/ativos-classify";

describe("inferAssetClass", () => {
  describe("BR ações", () => {
    it("PETR4 (PN) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("PETR4")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("VALE3 (ON) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("VALE3")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("ITUB4 (PN) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("ITUB4")).toBe("ACAO_BR_DIVIDENDO");
    });
  });

  describe("BR FII e ETF (*11)", () => {
    it("HGCR11 (FII) → FII", () => {
      expect(inferAssetClass("HGCR11")).toBe("FII");
    });

    it("MXRF11 (FII) → FII", () => {
      expect(inferAssetClass("MXRF11")).toBe("FII");
    });

    it("BOVA11 (ETF whitelist) → ETF_BR", () => {
      expect(inferAssetClass("BOVA11")).toBe("ETF_BR");
    });

    it("IVVB11 (ETF whitelist) → ETF_BR", () => {
      expect(inferAssetClass("IVVB11")).toBe("ETF_BR");
    });

    it("TAEE11 (UNIT whitelist) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("TAEE11")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("KLBN11 (UNIT Klabin) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("KLBN11")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("SAPR11 (UNIT Sanepar) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("SAPR11")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("ALUP11 (UNIT Alupar) → ACAO_BR_DIVIDENDO", () => {
      expect(inferAssetClass("ALUP11")).toBe("ACAO_BR_DIVIDENDO");
    });
  });

  describe("BR BDR (*34-*39)", () => {
    it("AAPL34 → BDR", () => {
      expect(inferAssetClass("AAPL34")).toBe("BDR");
    });

    it("DISB34 → BDR", () => {
      expect(inferAssetClass("DISB34")).toBe("BDR");
    });
  });

  describe("US stocks", () => {
    it("AAPL → STOCK_US", () => {
      expect(inferAssetClass("AAPL")).toBe("STOCK_US");
    });

    it("JNJ → STOCK_US", () => {
      expect(inferAssetClass("JNJ")).toBe("STOCK_US");
    });

    it("BRK (3 letters) → STOCK_US", () => {
      expect(inferAssetClass("BRK")).toBe("STOCK_US");
    });
  });

  describe("normalização e edge cases", () => {
    it("lower-case é normalizado pra upper-case", () => {
      expect(inferAssetClass("petr4")).toBe("ACAO_BR_DIVIDENDO");
    });

    it("espaços ao redor são removidos", () => {
      expect(inferAssetClass("  AAPL  ")).toBe("STOCK_US");
    });

    it("string vazia retorna null", () => {
      expect(inferAssetClass("")).toBeNull();
      expect(inferAssetClass("   ")).toBeNull();
    });

    it("padrão desconhecido (mistura de letras e números fora dos padrões B3) retorna null", () => {
      expect(inferAssetClass("X1Y2Z3")).toBeNull();
      expect(inferAssetClass("123")).toBeNull();
      expect(inferAssetClass("PETR.SA")).toBeNull(); // ponto não é parte do padrão
    });
  });
});
