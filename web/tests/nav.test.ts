import { describe, it, expect } from "vitest";
import { NAV_GROUPS, NAV_BY_HREF } from "@/lib/nav";

describe("nav config", () => {
  it("has 10 nav items in one ANÁLISE group", () => {
    expect(NAV_GROUPS).toHaveLength(1);
    expect(NAV_GROUPS[0].label).toBe("ANÁLISE");
    expect(NAV_GROUPS[0].items).toHaveLength(10);
  });

  it("first item is Visão Geral at root href", () => {
    const first = NAV_GROUPS[0].items[0];
    expect(first.label).toBe("Visão Geral");
    expect(first.href).toBe("/");
  });

  it("Risco MC item has 'MC' badge", () => {
    const risco = NAV_GROUPS[0].items.find((i) => i.label === "Risco MC");
    expect(risco?.badge).toBe("MC");
  });

  it("NAV_BY_HREF maps every href to its item", () => {
    expect(NAV_BY_HREF["/"]?.label).toBe("Visão Geral");
    expect(NAV_BY_HREF["/imovel"]?.label).toBe("Imóvel");
    expect(NAV_BY_HREF["/renda-fixa"]?.label).toBe("Renda Fixa");
    expect(NAV_BY_HREF["/ativos"]?.label).toBe("Ativos");
  });

  it("every item has a fase number indicating when content lands", () => {
    for (const item of NAV_GROUPS[0].items) {
      expect(item.fase).toBeGreaterThanOrEqual(3);
      expect(item.fase).toBeLessThanOrEqual(6);
    }
  });
});
