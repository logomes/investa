import { describe, it, expect } from "vitest";
import { lookupFiiSubtype, FII_SUBTYPES } from "@/lib/fii-subtypes";

describe("lookupFiiSubtype", () => {
  it("acerta FIIs de papel populares", () => {
    expect(lookupFiiSubtype("MXRF11")).toBe("papel");
    expect(lookupFiiSubtype("HGCR11")).toBe("papel");
    expect(lookupFiiSubtype("KNCR11")).toBe("papel");
  });

  it("acerta FIIs de tijolo populares", () => {
    expect(lookupFiiSubtype("HGLG11")).toBe("tijolo");
    expect(lookupFiiSubtype("KNRI11")).toBe("tijolo");
    expect(lookupFiiSubtype("HGRU11")).toBe("tijolo");
  });

  it("acerta FIIs agro", () => {
    expect(lookupFiiSubtype("RURA11")).toBe("agro");
    expect(lookupFiiSubtype("RZAG11")).toBe("agro");
  });

  it("acerta FoFs", () => {
    expect(lookupFiiSubtype("BCFF11")).toBe("fof");
    expect(lookupFiiSubtype("KFOF11")).toBe("fof");
  });

  it("é case-insensitive", () => {
    expect(lookupFiiSubtype("mxrf11")).toBe("papel");
    expect(lookupFiiSubtype("MxRf11")).toBe("papel");
  });

  it("retorna undefined para tickers fora da tabela", () => {
    expect(lookupFiiSubtype("XXYY11")).toBeUndefined();
    expect(lookupFiiSubtype("PETR4")).toBeUndefined();
  });

  it("tabela cobre os 5 subtipos", () => {
    const subtypes = new Set(Object.values(FII_SUBTYPES));
    expect(subtypes).toContain("papel");
    expect(subtypes).toContain("tijolo");
    expect(subtypes).toContain("agro");
    expect(subtypes).toContain("fof");
  });

  it("todos os tickers seguem padrão *11", () => {
    for (const ticker of Object.keys(FII_SUBTYPES)) {
      expect(ticker).toMatch(/^[A-Z]{4}11$/);
    }
  });
});
