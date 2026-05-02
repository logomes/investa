import { describe, it, expect } from "vitest";
import {
  grossAnnualRent,
  annualIptu,
  vacancyLoss,
  managementFee,
  incomeTaxAmount,
  totalCosts,
  netAnnualIncome,
  grossYield,
  netYield,
  costBreakdown,
  incomeWaterfall,
  financingSummary,
  acquisitionCosts,
  REAL_ESTATE_RISKS,
} from "@/lib/imovel-derive";
import type { RealEstateInput, FinancingInput } from "@/lib/api-types";

const RE: RealEstateInput = {
  propertyValue: 230_000,
  monthlyRent: 1_500,
  annualAppreciation: 0.055,
  iptuRate: 0.010,
  vacancyMonthsPerYear: 1.0,
  managementFeePct: 0.10,
  maintenanceAnnual: 900,
  insuranceAnnual: 600,
  incomeTaxBracket: 0.075,
  acquisitionCostPct: 0.05,
  appreciationVolatility: 0.10,
  financing: null,
};

const FIN: FinancingInput = {
  termYears: 30,
  annualRate: 0.115,
  entryPct: 0.20,
  system: "SAC",
  monthlyInsuranceRate: 0.0005,
};

describe("imovel-derive — KPIs", () => {
  it("grossAnnualRent: monthlyRent * 12", () => {
    expect(grossAnnualRent(RE)).toBe(18_000);
  });

  it("annualIptu: propertyValue * iptuRate", () => {
    expect(annualIptu(RE)).toBe(2_300);
  });

  it("vacancyLoss: monthlyRent * vacancyMonthsPerYear", () => {
    expect(vacancyLoss(RE)).toBe(1_500);
  });

  it("managementFee: 10% do aluguel bruto", () => {
    expect(managementFee(RE)).toBe(1_800);
  });

  it("incomeTaxAmount: 7,5% sobre aluguel após vacância", () => {
    expect(incomeTaxAmount(RE)).toBeCloseTo(1_237.5, 2);
  });

  it("totalCosts soma os 6 itens (IPTU+vacância+manut+adm+seguro+IR)", () => {
    expect(totalCosts(RE)).toBeCloseTo(8_337.5, 2);
  });

  it("netAnnualIncome: grossRent - totalCosts", () => {
    expect(netAnnualIncome(RE)).toBeCloseTo(9_662.5, 2);
  });

  it("grossYield ~ 7,83%", () => {
    expect(grossYield(RE)).toBeCloseTo(0.0783, 4);
  });

  it("netYield ~ 4,2%", () => {
    expect(netYield(RE)).toBeCloseTo(0.0420, 3);
  });

  it("totalCosts >= 0 sempre (sanity)", () => {
    expect(totalCosts({ ...RE, vacancyMonthsPerYear: 0, incomeTaxBracket: 0 })).toBeGreaterThanOrEqual(0);
  });

  it("vacancyLoss = 0 quando vacancyMonthsPerYear = 0", () => {
    const re = { ...RE, vacancyMonthsPerYear: 0 };
    expect(vacancyLoss(re)).toBe(0);
    expect(costBreakdown(re)[1].value).toBe(0);
  });

  it("incomeTaxAmount = 0 quando incomeTaxBracket = 0", () => {
    expect(incomeTaxAmount({ ...RE, incomeTaxBracket: 0 })).toBe(0);
  });
});

describe("imovel-derive — costBreakdown", () => {
  it("retorna 6 itens com label + value + color", () => {
    const items = costBreakdown(RE);
    expect(items).toHaveLength(6);
    const labels = items.map((i) => i.label);
    expect(labels).toEqual([
      "IPTU",
      "Vacância",
      "Manutenção",
      "Adm. Imobiliária",
      "Seguro",
      "IR sobre Aluguel",
    ]);
    expect(items.every((i) => typeof i.color === "string" && i.color.startsWith("#"))).toBe(true);
  });

  it("soma dos values bate com totalCosts", () => {
    const sum = costBreakdown(RE).reduce((s, i) => s + i.value, 0);
    expect(sum).toBeCloseTo(totalCosts(RE), 2);
  });
});

describe("imovel-derive — incomeWaterfall", () => {
  it("5 entradas: start, 3 deductions, end", () => {
    const wf = incomeWaterfall(RE);
    expect(wf).toHaveLength(5);
    expect(wf[0].type).toBe("start");
    expect(wf[1].type).toBe("deduction");
    expect(wf[2].type).toBe("deduction");
    expect(wf[3].type).toBe("deduction");
    expect(wf[4].type).toBe("end");
  });

  it("primeiro = grossAnnualRent, último = netAnnualIncome", () => {
    const wf = incomeWaterfall(RE);
    expect(wf[0].value).toBe(grossAnnualRent(RE));
    expect(wf[4].value).toBeCloseTo(netAnnualIncome(RE), 2);
  });

  it("deductions são negativas", () => {
    const wf = incomeWaterfall(RE);
    expect(wf[1].value).toBeLessThan(0);
    expect(wf[2].value).toBeLessThan(0);
    expect(wf[3].value).toBeLessThan(0);
  });
});

describe("imovel-derive — financingSummary", () => {
  it("null quando financing == null", () => {
    expect(financingSummary(RE)).toBeNull();
  });

  it("entry = 46k e loanPrincipal = 184k para defaults", () => {
    const f = financingSummary({ ...RE, financing: FIN })!;
    expect(f.entry).toBe(46_000);
    expect(f.loanPrincipal).toBe(184_000);
    expect(f.termYears).toBe(30);
    expect(f.systemLabel).toBe("SAC");
  });

  it("SAC firstPayment = P/n + P*i (closed-form)", () => {
    const f = financingSummary({ ...RE, financing: FIN })!;
    expect(f.firstPayment).toBeCloseTo(2_187.8, 0);
  });

  it("SAC totalInterest = P*i*(n+1)/2", () => {
    const f = financingSummary({ ...RE, financing: FIN })!;
    expect(f.totalInterest).toBeCloseTo(302_643, -2);
  });

  it("Price firstPayment usa fórmula PMT", () => {
    const fin: FinancingInput = { ...FIN, system: "Price" };
    const f = financingSummary({ ...RE, financing: fin })!;
    expect(f.firstPayment).toBeCloseTo(1_743, 0);
  });

  it("Price totalInterest = PMT*n - P", () => {
    const fin: FinancingInput = { ...FIN, system: "Price" };
    const f = financingSummary({ ...RE, financing: fin })!;
    expect(f.totalInterest).toBeCloseTo(443_566, -2);
  });

  it("Price annualRate=0: firstPayment = P/n, totalInterest = 0", () => {
    const fin: FinancingInput = { ...FIN, system: "Price", annualRate: 0 };
    const f = financingSummary({ ...RE, financing: fin })!;
    // P = 230_000 * (1 - 0.20) = 184_000; n = 30 * 12 = 360
    expect(f.firstPayment).toBeCloseTo(511.111, 2);
    expect(f.totalInterest).toBe(0);
  });
});

describe("imovel-derive — acquisitionCosts", () => {
  it("retorna 2 linhas: ITBI e Caução", () => {
    const items = acquisitionCosts(RE);
    expect(items).toHaveLength(2);
    expect(items[0].item).toContain("ITBI");
    expect(items[0].value).toBe(11_500);
    expect(items[1].item).toContain("Caução");
    expect(items[1].value).toBe(4_500);
  });
});

describe("imovel-derive — REAL_ESTATE_RISKS", () => {
  it("tem 6 entradas com title e body", () => {
    expect(REAL_ESTATE_RISKS).toHaveLength(6);
    REAL_ESTATE_RISKS.forEach((r) => {
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
    });
  });
});
