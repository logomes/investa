import type { RealEstateInput, FinancingInput } from "./api-types";

// ---------- KPIs ----------

export function grossAnnualRent(re: RealEstateInput): number {
  return re.monthlyRent * 12;
}

export function annualIptu(re: RealEstateInput): number {
  return re.propertyValue * re.iptuRate;
}

export function vacancyLoss(re: RealEstateInput): number {
  return re.monthlyRent * re.vacancyMonthsPerYear;
}

export function managementFee(re: RealEstateInput): number {
  return grossAnnualRent(re) * re.managementFeePct;
}

export function incomeTaxAmount(re: RealEstateInput): number {
  const taxable = grossAnnualRent(re) - vacancyLoss(re);
  return taxable * re.incomeTaxBracket;
}

export function totalCosts(re: RealEstateInput): number {
  return (
    annualIptu(re)
    + vacancyLoss(re)
    + re.maintenanceAnnual
    + managementFee(re)
    + re.insuranceAnnual
    + incomeTaxAmount(re)
  );
}

export function netAnnualIncome(re: RealEstateInput): number {
  return grossAnnualRent(re) - totalCosts(re);
}

export function grossYield(re: RealEstateInput): number {
  return grossAnnualRent(re) / re.propertyValue;
}

export function netYield(re: RealEstateInput): number {
  return netAnnualIncome(re) / re.propertyValue;
}

// ---------- Decomposição de custos ----------

export type CostBreakdownItem = { label: string; value: number; color: string };

export function costBreakdown(re: RealEstateInput): CostBreakdownItem[] {
  return [
    { label: "IPTU",             value: annualIptu(re),       color: "#FFC857" },
    { label: "Vacância",         value: vacancyLoss(re),      color: "#FF6B5B" },
    { label: "Manutenção",       value: re.maintenanceAnnual, color: "#5CC8FF" },
    { label: "Adm. Imobiliária", value: managementFee(re),    color: "#46E8A4" },
    { label: "Seguro",           value: re.insuranceAnnual,   color: "#7D9591" },
    { label: "IR sobre Aluguel", value: incomeTaxAmount(re),  color: "#FF5D72" },
  ];
}

// ---------- Waterfall receita × custos ----------

export type WaterfallItem = {
  label: string;
  value: number;
  type: "start" | "deduction" | "end";
};

export function incomeWaterfall(re: RealEstateInput): WaterfallItem[] {
  const gross = grossAnnualRent(re);
  const vac = vacancyLoss(re);
  const operacional = annualIptu(re) + re.maintenanceAnnual + managementFee(re) + re.insuranceAnnual;
  const ir = incomeTaxAmount(re);
  const liquido = gross - vac - operacional - ir;
  return [
    { label: "Aluguel bruto",   value: gross,        type: "start" },
    { label: "Vacância",        value: -vac,         type: "deduction" },
    { label: "Custos op.",      value: -operacional, type: "deduction" },
    { label: "IR aluguel",      value: -ir,          type: "deduction" },
    { label: "Receita líquida", value: liquido,      type: "end" },
  ];
}

// ---------- Financing summary ----------

export type FinancingSummary = {
  entry: number;
  loanPrincipal: number;
  termYears: number;
  systemLabel: "SAC" | "Price";
  firstPayment: number;
  totalInterest: number;
};

export function financingSummary(re: RealEstateInput): FinancingSummary | null {
  if (re.financing === null) return null;
  const fin = re.financing;
  const entry = re.propertyValue * fin.entryPct;
  const P = re.propertyValue - entry;
  const n = fin.termYears * 12;
  const i = Math.pow(1 + fin.annualRate, 1 / 12) - 1;

  let firstPayment: number;
  let totalInterest: number;
  if (fin.system === "SAC") {
    const amort = P / n;
    firstPayment = amort + P * i;
    totalInterest = i * P * (n + 1) / 2;
  } else {
    const pmt = P * i / (1 - Math.pow(1 + i, -n));
    firstPayment = pmt;
    totalInterest = pmt * n - P;
  }

  return {
    entry,
    loanPrincipal: P,
    termYears: fin.termYears,
    systemLabel: fin.system,
    firstPayment,
    totalInterest,
  };
}

// ---------- Custos não-recorrentes ----------

export type AcquisitionItem = { item: string; value: number };

export function acquisitionCosts(re: RealEstateInput): AcquisitionItem[] {
  return [
    { item: "ITBI + cartório",       value: re.propertyValue * re.acquisitionCostPct },
    { item: "Caução (3× aluguel)",   value: re.monthlyRent * 3 },
  ];
}

// ---------- Riscos ----------

export const REAL_ESTATE_RISKS: Array<{ title: string; body: string }> = [
  { title: "Concentração",     body: "1 ativo = 100% do capital. Sem diversificação geográfica ou setorial." },
  { title: "Iliquidez",         body: "3 a 12 meses para vender; preço pode cair em mercado adverso." },
  { title: "Inadimplência",     body: "1 a 2 meses comuns mesmo com fiança; ações de despejo demoram." },
  { title: "Vacância prolongada", body: "Paralisa receita e mantém custos fixos (IPTU, condomínio, manutenção)." },
  { title: "Risco regulatório", body: "Lei do inquilinato favorece locatário; reajustes restritos a IGPM/IPCA." },
  { title: "Depreciação",       body: "Reformas estruturais (telhado, hidráulica, fachada) a cada 7-10 anos." },
];
