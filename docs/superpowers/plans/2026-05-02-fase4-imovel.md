# Aba Imóvel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/imovel/page.tsx` por uma aba de análise read-only do imóvel configurado no cenário, e adicionar `FinancingSection` ao Drawer global.

**Architecture:** A aba lê `scenario.realEstate` do `useScenarioStore` (Zustand) e `simulationResult.realEstate` de `useSimulate()` (TanStack Query). KPIs e decomposição de custos são derivados client-side em `lib/imovel-derive.ts` (puro). O Drawer ganha uma seção de financiamento com toggle on/off que define `realEstate.financing` (zod schema já aceita `nullable`). Não há store novo.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui (base-nova), TanStack Query v5, Zustand v5, react-hook-form 7, zod 3, vitest, @testing-library/react.

**Branch base:** `feat/fase4-imovel-spec` (já existe). Implementação acontece em `feat/fase4-imovel`.

**Spec:** `docs/superpowers/specs/2026-05-02-fase4-imovel-design.md`.

---

## File Structure

**Cria:**
```
web/lib/imovel-derive.ts                                            # fórmulas puras + REAL_ESTATE_RISKS
web/components/imovel/ImovelPageContent.tsx                         # client wrapper
web/components/imovel/KpiRowImovel.tsx                              # bloco KPI (4 cards)
web/components/imovel/CostBreakdownCard.tsx                         # bloco 1
web/components/imovel/IncomeVsCostsCard.tsx                         # bloco 2 (waterfall mini)
web/components/imovel/FinancingCard.tsx                             # bloco 3 (condicional)
web/components/imovel/AcquisitionCostsCard.tsx                      # bloco 4
web/components/imovel/RisksCard.tsx                                 # bloco 5
web/components/imovel/EvolutionCard.tsx                             # bloco 6 (linha)
web/components/scenario-drawer/sections/FinancingSection.tsx        # NEW Drawer section
web/tests/imovel-derive.test.ts                                     # ~15 testes
web/tests/imovel-page.test.tsx                                      # ~5 testes (smoke)
web/tests/financing-section.test.tsx                                # ~5 testes
```

**Modifica:**
```
web/app/imovel/page.tsx                                             # placeholder → wire ImovelPageContent
web/lib/defaults.ts                                                 # adiciona DEFAULT_FINANCING
web/components/scenario-drawer/ScenarioDrawer.tsx                   # importa + renderiza FinancingSection
README.md                                                           # marca aba Imóvel ✅
```

**Não toca:**
- `api/` — engine já implementa SAC/Price; testes passam; nenhuma alteração de backend
- `web/components/scenario-drawer/schema.ts` — `financing: financingSchema.nullable()` já está correto
- `web/components/scenario-drawer/sections/RealEstateSection.tsx` — fica como está

---

## Task 1: Branch + setup

**Files:**
- Modify: working directory state

- [ ] **Step 1: Confirm starting state**

```bash
cd /home/lucgomes/workspace/investa
git status
git branch --show-current
```
Expected: branch `feat/fase4-imovel-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-imovel
```
Expected: switched to new branch.

- [ ] **Step 3: Confirm test runner works**

```bash
cd /home/lucgomes/workspace/investa/web
pnpm test --run 2>&1 | tail -20
```
Expected: all existing tests pass (Renda Fixa, etc.). If pnpm not installed, use `npm test` or `npx vitest run`.

- [ ] **Step 4: Commit empty marker (optional anchor for branch)**

Skip if working tree is clean. No commit needed yet.

---

## Task 2: `lib/imovel-derive.ts` — fórmulas puras (TDD)

**Files:**
- Create: `web/tests/imovel-derive.test.ts`
- Create: `web/lib/imovel-derive.ts`

- [ ] **Step 1: Write failing test file**

Create `web/tests/imovel-derive.test.ts`:

```ts
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
    // (18000 - 1500) * 0.075 = 1237.5
    expect(incomeTaxAmount(RE)).toBeCloseTo(1_237.5, 2);
  });

  it("totalCosts soma os 6 itens (IPTU+vacância+manut+adm+seguro+IR)", () => {
    // 2300 + 1500 + 900 + 1800 + 600 + 1237.5 = 8337.5
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
    // i = 1.115^(1/12) - 1 ≈ 0.0091082
    // P = 184000, n = 360
    // amort = 511.11, juros = 1675.91 → ~2187.02
    expect(f.firstPayment).toBeCloseTo(2_187, 0);
  });

  it("SAC totalInterest = P*i*(n+1)/2", () => {
    const f = financingSummary({ ...RE, financing: FIN })!;
    // 0.0091082 * 184000 * 361 / 2 ≈ 302_528
    expect(f.totalInterest).toBeCloseTo(302_528, -2);  // ±100
  });

  it("Price firstPayment usa fórmula PMT", () => {
    const fin: FinancingInput = { ...FIN, system: "Price" };
    const f = financingSummary({ ...RE, financing: fin })!;
    // PMT = P * i / (1 - (1+i)^(-n))
    // = 184000 * 0.0091082 / (1 - 1.0091082^(-360))
    // ≈ 1820.6
    expect(f.firstPayment).toBeCloseTo(1_821, 0);
  });

  it("Price totalInterest = PMT*n - P", () => {
    const fin: FinancingInput = { ...FIN, system: "Price" };
    const f = financingSummary({ ...RE, financing: fin })!;
    // ≈ 1820.6 * 360 - 184000 ≈ 471_416
    expect(f.totalInterest).toBeCloseTo(471_416, -2);
  });
});

describe("imovel-derive — acquisitionCosts", () => {
  it("retorna 2 linhas: ITBI e Caução", () => {
    const items = acquisitionCosts(RE);
    expect(items).toHaveLength(2);
    expect(items[0].item).toContain("ITBI");
    expect(items[0].value).toBe(11_500);  // 230k * 5%
    expect(items[1].item).toContain("Caução");
    expect(items[1].value).toBe(4_500);  // 1500 * 3
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/imovel-derive.test.ts 2>&1 | tail -20
```
Expected: all tests fail with "module not found" or similar.

- [ ] **Step 3: Create the implementation**

Create `web/lib/imovel-derive.ts`:

```ts
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
    // Price
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/imovel-derive.test.ts 2>&1 | tail -20
```
Expected: all tests pass (~17 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/imovel-derive.ts web/tests/imovel-derive.test.ts
git commit -m "feat(imovel): add imovel-derive lib with KPIs, breakdown, waterfall, financing summary"
```

---

## Task 3: `lib/defaults.ts` — DEFAULT_FINANCING

**Files:**
- Modify: `web/lib/defaults.ts`

- [ ] **Step 1: Read current state**

```bash
cat /home/lucgomes/workspace/investa/web/lib/defaults.ts
```
Note: `FinancingInput` already imported transitively via `SimulateInput`.

- [ ] **Step 2: Add export**

Edit `web/lib/defaults.ts` — append at the bottom of the file (after `DEFAULT_GOAL`):

```ts
import type { FinancingInput } from "./api-types";

export const DEFAULT_FINANCING: FinancingInput = {
  termYears: 30,
  annualRate: 0.115,
  entryPct: 0.20,
  system: "SAC",
  monthlyInsuranceRate: 0.0005,
};
```

If the import line `import type { ... } from "./api-types"` already exists at the top, add `FinancingInput` to it instead of creating a second import line.

- [ ] **Step 3: Confirm typecheck passes**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -10
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/defaults.ts
git commit -m "feat(imovel): add DEFAULT_FINANCING export"
```

---

## Task 4: `FinancingSection.tsx` — Drawer section + tests

**Files:**
- Create: `web/tests/financing-section.test.tsx`
- Create: `web/components/scenario-drawer/sections/FinancingSection.tsx`
- Modify: `web/components/scenario-drawer/ScenarioDrawer.tsx`

- [ ] **Step 1: Write failing test**

Create `web/tests/financing-section.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FinancingSection } from "@/components/scenario-drawer/sections/FinancingSection";
import { scenarioFormSchema, type ScenarioFormValues } from "@/components/scenario-drawer/schema";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_FINANCING } from "@/lib/defaults";

function Harness({ initial }: { initial: ScenarioFormValues }) {
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: initial,
  });
  return (
    <FormProvider {...form}>
      <FinancingSection />
      <output data-testid="financing-state">
        {JSON.stringify(form.watch("realEstate.financing"))}
      </output>
    </FormProvider>
  );
}

const baseValues: ScenarioFormValues = { ...DEFAULT_SCENARIO, mc: DEFAULT_MC };

describe("FinancingSection", () => {
  it("toggle desligado quando financing é null; campos não aparecem", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
    expect(screen.queryByLabelText(/prazo \(anos\)/i)).not.toBeInTheDocument();
  });

  it("toggle ligado expõe 5 campos (4 inputs + 1 select)", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: DEFAULT_FINANCING } }} />);
    expect(screen.getByLabelText(/prazo \(anos\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/taxa anual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/entrada/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seguro mensal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sistema/i)).toBeInTheDocument();
  });

  it("ligar toggle preenche financing com DEFAULT_FINANCING", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    const state = screen.getByTestId("financing-state").textContent!;
    const parsed = JSON.parse(state);
    expect(parsed).toEqual(DEFAULT_FINANCING);
  });

  it("desligar toggle volta financing para null", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: DEFAULT_FINANCING } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
  });

  it("ciclo off→on→off não vaza valores", () => {
    render(<Harness initial={{ ...baseValues, realEstate: { ...baseValues.realEstate, financing: null } }} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByTestId("financing-state").textContent).toBe("null");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/financing-section.test.tsx 2>&1 | tail -10
```
Expected: fails with "module not found".

- [ ] **Step 3: Create FinancingSection**

Create `web/components/scenario-drawer/sections/FinancingSection.tsx`:

```tsx
"use client";

import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DEFAULT_FINANCING } from "@/lib/defaults";

const NUMBER_INPUTS: Array<{
  name: "termYears" | "annualRate" | "entryPct" | "monthlyInsuranceRate";
  label: string;
  step: string;
  hint?: string;
}> = [
  { name: "termYears",            label: "Prazo (anos)",              step: "1" },
  { name: "annualRate",           label: "Taxa anual",                step: "0.005", hint: "0,115 = 11,5%" },
  { name: "entryPct",             label: "Entrada",                   step: "0.05",  hint: "0,20 = 20%" },
  { name: "monthlyInsuranceRate", label: "Seguro mensal sobre saldo", step: "0.0001", hint: "0,0005 = 0,05%/mês" },
];

export function FinancingSection() {
  const { register, watch, setValue } = useFormContext<ScenarioFormValues>();
  const financing = watch("realEstate.financing");
  const enabled = financing !== null;

  const onToggle = (v: boolean) => {
    setValue("realEstate.financing", v ? DEFAULT_FINANCING : null, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">
          Financiamento
        </h3>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Financiar imóvel" />
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-3">
          {NUMBER_INPUTS.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={`fin-${f.name}`} className="text-xs">{f.label}</Label>
              <Input
                id={`fin-${f.name}`}
                type="number"
                step={f.step}
                {...register(`realEstate.financing.${f.name}`, { valueAsNumber: true })}
              />
              {f.hint && <p className="text-[10px] text-ink-4">{f.hint}</p>}
            </div>
          ))}
          <div className="space-y-1 col-span-2">
            <Label htmlFor="fin-system" className="text-xs">Sistema</Label>
            <Select
              value={watch("realEstate.financing.system") ?? "SAC"}
              onValueChange={(v) => setValue("realEstate.financing.system", v as "SAC" | "Price", { shouldDirty: true })}
            >
              <SelectTrigger id="fin-system">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAC">SAC (parcelas decrescentes)</SelectItem>
                <SelectItem value="Price">Price (parcelas constantes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/financing-section.test.tsx 2>&1 | tail -10
```
Expected: all 5 tests pass.

- [ ] **Step 5: Wire into ScenarioDrawer**

Edit `web/components/scenario-drawer/ScenarioDrawer.tsx`. Add import after line 11 (after `RealEstateSection` import):

```tsx
import { FinancingSection } from "./sections/FinancingSection";
```

Then in the form JSX (after `<RealEstateSection />`), add:

```tsx
<FinancingSection />
```

So the form now reads:
```tsx
<CapitalSection />
<RealEstateSection />
<FinancingSection />
<PortfolioSection />
<BenchmarkSection />
<MonteCarloSection />
```

- [ ] **Step 6: Confirm typecheck + tests still pass**

```bash
npx tsc --noEmit 2>&1 | tail -5
npx vitest run 2>&1 | tail -10
```
Expected: clean typecheck; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/components/scenario-drawer/sections/FinancingSection.tsx \
        web/components/scenario-drawer/ScenarioDrawer.tsx \
        web/tests/financing-section.test.tsx
git commit -m "feat(drawer): add FinancingSection with toggle and SAC/Price select"
```

---

## Task 5: `KpiRowImovel.tsx` — bloco KPI

**Files:**
- Create: `web/components/imovel/KpiRowImovel.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/imovel
```

- [ ] **Step 2: Create component**

Create `web/components/imovel/KpiRowImovel.tsx`:

```tsx
"use client";

import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import {
  grossYield, netYield, netAnnualIncome, totalCosts, grossAnnualRent,
} from "@/lib/imovel-derive";
import { formatPercent, formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function KpiRowImovel({ re }: Props) {
  const gy = grossYield(re);
  const ny = netYield(re);
  const netIncome = netAnnualIncome(re);
  const costs = totalCosts(re);
  const costRatio = grossAnnualRent(re) > 0 ? costs / grossAnnualRent(re) : 0;
  const yieldDelta = ny - gy;  // negativo

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="Yield Bruto"
        value={formatPercent(gy, 2)}
        icon={TrendingUp}
        sub="aluguel anual / valor"
      />
      <KpiCard
        label="Yield Líquido"
        value={formatPercent(ny, 2)}
        delta={{ value: formatPercent(yieldDelta, 2), dir: "down" }}
        icon={TrendingDown}
        sub="após custos"
      />
      <KpiCard
        label="Receita Líquida Anual"
        value={formatRs(netIncome)}
        icon={Wallet}
        valueColor="green"
      />
      <KpiCard
        label="Custo Total Anual"
        value={formatRs(costs)}
        icon={Receipt}
        sub={`${formatPercent(costRatio, 1)} da receita`}
        valueColor="red"
      />
    </div>
  );
}
```

- [ ] **Step 3: Confirm typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/components/imovel/KpiRowImovel.tsx
git commit -m "feat(imovel): add KpiRowImovel — 4 KPIs (yields, receita, custo)"
```

---

## Task 6: `CostBreakdownCard.tsx` — barras horizontais

**Files:**
- Create: `web/components/imovel/CostBreakdownCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/CostBreakdownCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { costBreakdown, totalCosts } from "@/lib/imovel-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function CostBreakdownCard({ re }: Props) {
  const items = costBreakdown(re);
  const total = totalCosts(re);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Decomposição de custos</h3>
          <span className="text-xs text-ink-3 tabular">{formatRs(total)} total</span>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem custos configurados</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pct = total > 0 ? item.value / total : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="text-ink-3 tabular">
                      {formatRs(item.value)} <span className="text-ink-4">· {formatPercent(pct, 1)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/CostBreakdownCard.tsx
git commit -m "feat(imovel): add CostBreakdownCard with horizontal bar breakdown"
```

---

## Task 7: `IncomeVsCostsCard.tsx` — waterfall mini

**Files:**
- Create: `web/components/imovel/IncomeVsCostsCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/IncomeVsCostsCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { incomeWaterfall, grossAnnualRent } from "@/lib/imovel-derive";
import { formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function IncomeVsCostsCard({ re }: Props) {
  const items = incomeWaterfall(re);
  const max = Math.max(grossAnnualRent(re), 1);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Receita × Custos (anual)</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 items-end h-[180px]">
          {items.map((it) => {
            const height = Math.max(8, (Math.abs(it.value) / max) * 140);
            const color =
              it.type === "start"     ? "bg-accent-cyan"
              : it.type === "end"     ? "bg-accent-green"
              :                          "bg-accent-coral";
            const valueColor =
              it.type === "deduction" ? "text-accent-coral" : "text-ink";
            return (
              <div key={it.label} className="flex flex-col items-center justify-end gap-1.5 h-full">
                <span className={`text-[11px] tabular ${valueColor}`}>
                  {it.type === "deduction" ? "−" : ""}{formatRs(Math.abs(it.value))}
                </span>
                <div className={`${color} w-full rounded-t-sm`} style={{ height: `${height}px` }} />
                <span className="text-[10px] text-ink-3 text-center leading-tight">{it.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/IncomeVsCostsCard.tsx
git commit -m "feat(imovel): add IncomeVsCostsCard waterfall mini (5 bars)"
```

---

## Task 8: `FinancingCard.tsx` — KPIs + chart saldo devedor

**Files:**
- Create: `web/components/imovel/FinancingCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/FinancingCard.tsx`:

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { KpiCard } from "@/components/kpi/KpiCard";
import { financingSummary } from "@/lib/imovel-derive";
import { formatRs, formatRsK } from "@/lib/format";
import type { RealEstateInput, SimulationResultOut } from "@/lib/api-types";

type Props = {
  re: RealEstateInput;
  simulation: SimulationResultOut;
};

export function FinancingCard({ re, simulation }: Props) {
  const summary = financingSummary(re);
  if (!summary) return null;

  const debtBalance = simulation.debtBalance ?? [];
  const internalPortfolio = simulation.internalPortfolio ?? [];
  const negative = internalPortfolio.length > 0 && Math.min(...internalPortfolio) < 0;
  const negativeYear = negative
    ? simulation.years[internalPortfolio.findIndex((v) => v < 0)]
    : null;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Financiamento</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Entrada" value={formatRs(summary.entry)} sub={`${(re.financing!.entryPct * 100).toFixed(0)}% do imóvel`} />
          <KpiCard label="Parcela inicial" value={formatRs(summary.firstPayment)} sub={summary.systemLabel} />
          <KpiCard label="Total de juros" value={formatRsK(summary.totalInterest)} sub={`prazo ${summary.termYears} anos`} />
          <KpiCard label="Principal" value={formatRsK(summary.loanPrincipal)} sub="financiado" />
        </div>

        {negative && (
          <div className="flex items-start gap-2 bg-accent-amber/10 border border-accent-amber/40 rounded-card p-3">
            <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink">
              Carteira interna fica deficitária a partir do ano {negativeYear}. Em vida real, exigiria
              injeção de capital externo. Considere aumentar entrada, prazo, ou o aluguel-alvo.
            </p>
          </div>
        )}

        {debtBalance.length > 0 && (
          <div>
            <h4 className="text-[12px] text-ink-3 mb-2">Saldo devedor ano a ano</h4>
            <LineChart
              series={[{ name: "Saldo devedor", color: "#FF5D72", values: debtBalance }]}
              xLabels={simulation.years.map(String)}
              height={200}
              yFormat={(v) => formatRsK(v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/FinancingCard.tsx
git commit -m "feat(imovel): add FinancingCard with 4 KPIs + saldo devedor LineChart"
```

---

## Task 9: `AcquisitionCostsCard.tsx` — tabela 2 linhas

**Files:**
- Create: `web/components/imovel/AcquisitionCostsCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/AcquisitionCostsCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { acquisitionCosts } from "@/lib/imovel-derive";
import { formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function AcquisitionCostsCard({ re }: Props) {
  const items = acquisitionCosts(re);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Custos não-recorrentes</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.item} className="flex items-center justify-between border-b border-line-soft pb-2 last:border-b-0">
              <span className="text-[13px] text-ink">{it.item}</span>
              <span className="text-[13px] text-ink tabular">{formatRs(it.value)}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ink-4 mt-3">
          Reformas e mobília (R$ 5k–35k) ficam fora desta análise.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/AcquisitionCostsCard.tsx
git commit -m "feat(imovel): add AcquisitionCostsCard (ITBI + caução)"
```

---

## Task 10: `RisksCard.tsx` — bullet list

**Files:**
- Create: `web/components/imovel/RisksCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/RisksCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { REAL_ESTATE_RISKS } from "@/lib/imovel-derive";

export function RisksCard() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Riscos críticos</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {REAL_ESTATE_RISKS.map((r) => (
            <li key={r.title} className="text-[12px]">
              <span className="font-semibold text-ink">{r.title}</span>
              <span className="text-ink-3"> — {r.body}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/RisksCard.tsx
git commit -m "feat(imovel): add RisksCard with 6 hardcoded risks"
```

---

## Task 11: `EvolutionCard.tsx` — chart valor + dívida + carteira interna

**Files:**
- Create: `web/components/imovel/EvolutionCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/imovel/EvolutionCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { formatRsK } from "@/lib/format";
import type { SimulationResultOut } from "@/lib/api-types";

type Props = { simulation: SimulationResultOut };

export function EvolutionCard({ simulation }: Props) {
  const series = [
    { name: "Patrimônio", color: "#46E8A4", values: simulation.patrimony, width: 2 },
  ];
  if (simulation.debtBalance && simulation.debtBalance.some((v) => v > 0)) {
    series.push({ name: "Saldo devedor", color: "#FF5D72", values: simulation.debtBalance, width: 1.5 });
  }
  if (simulation.internalPortfolio && simulation.internalPortfolio.length > 0) {
    series.push({ name: "Carteira interna", color: "#5CC8FF", values: simulation.internalPortfolio, width: 1.5 });
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Evolução do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <LineChart
          series={series}
          xLabels={simulation.years.map(String)}
          height={300}
          yFormat={(v) => formatRsK(v)}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/imovel/EvolutionCard.tsx
git commit -m "feat(imovel): add EvolutionCard with conditional series (patrimony/debt/internal)"
```

---

## Task 12: `ImovelPageContent.tsx` — orchestrator + smoke test + wire route

**Files:**
- Create: `web/components/imovel/ImovelPageContent.tsx`
- Create: `web/tests/imovel-page.test.tsx`
- Modify: `web/app/imovel/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/imovel-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImovelPageContent } from "@/components/imovel/ImovelPageContent";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { SimulateOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: typeof DEFAULT_SCENARIO }) => T) =>
    selector({ scenario: DEFAULT_SCENARIO }),
}));

const fakeSimOut = (financed: boolean): SimulateOut => ({
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5],
    patrimony: [230_000, 245_000, 260_000, 275_000, 290_000, 305_000],
    annualIncome: [9_662, 10_000, 10_500, 11_000, 11_500, 12_000],
    cumulativeIncome: [0, 9_662, 19_662, 30_162, 41_162, 52_662],
    debtBalance: financed ? [184_000, 178_000, 171_500, 164_500, 157_000, 149_000] : null,
    internalPortfolio: financed ? [0, 200, 500, 700, 1_000, 1_300] : null,
  } as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [] as never,
  taxComparison: [] as never,
});

let mockSimReturn: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useSimulate: () => mockSimReturn,
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("ImovelPageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut(false), isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs com defaults (Yield Bruto / Líquido visíveis)", () => {
    render(wrap(<ImovelPageContent />));
    expect(screen.getByText(/yield bruto/i)).toBeInTheDocument();
    expect(screen.getByText(/yield líquido/i)).toBeInTheDocument();
  });

  it("financing == null → FinancingCard não monta", () => {
    render(wrap(<ImovelPageContent />));
    expect(screen.queryByText(/parcela inicial/i)).not.toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<ImovelPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<ImovelPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/imovel-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create ImovelPageContent**

Create `web/components/imovel/ImovelPageContent.tsx`:

```tsx
"use client";

import { useScenarioStore } from "@/lib/store";
import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { KpiRowImovel } from "./KpiRowImovel";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { IncomeVsCostsCard } from "./IncomeVsCostsCard";
import { FinancingCard } from "./FinancingCard";
import { AcquisitionCostsCard } from "./AcquisitionCostsCard";
import { RisksCard } from "./RisksCard";
import { EvolutionCard } from "./EvolutionCard";

export function ImovelPageContent() {
  const scenario = useScenarioStore((s) => s.scenario);
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const re = scenario.realEstate;
  const realEstateSim = sim.data!.realEstate;

  return (
    <div className="space-y-6">
      <KpiRowImovel re={re} />

      <div className="grid grid-cols-2 gap-6">
        <CostBreakdownCard re={re} />
        <IncomeVsCostsCard re={re} />
      </div>

      {re.financing !== null && (
        <FinancingCard re={re} simulation={realEstateSim} />
      )}

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <EvolutionCard simulation={realEstateSim} />
        <div className="space-y-6">
          <AcquisitionCostsCard re={re} />
          <RisksCard />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire route**

Edit `web/app/imovel/page.tsx`. Replace entire content:

```tsx
import { ImovelPageContent } from "@/components/imovel/ImovelPageContent";

export default function ImovelPage() {
  return <ImovelPageContent />;
}
```

- [ ] **Step 5: Run tests + typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
npx vitest run tests/imovel-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; smoke tests pass (loading + error + KPIs visible).

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1 | tail -15
```
Expected: all tests pass (Renda Fixa + Imóvel + financing-section + derive).

- [ ] **Step 7: Commit**

```bash
git add web/app/imovel/page.tsx \
        web/components/imovel/ImovelPageContent.tsx \
        web/tests/imovel-page.test.tsx
git commit -m "feat(imovel): wire ImovelPageContent with conditional FinancingCard + smoke tests"
```

---

## Task 13: README + push + smoke prod + merge

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find the line `- ✅ Renda Fixa (...)` under Fase 4. Change `- ⬜ Imóvel` to `- ✅ Imóvel (KPIs, custos, financiamento opcional, evolução, riscos)`.

- [ ] **Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: mark aba Imóvel complete"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/fase4-imovel
```
Expected: branch pushed; Vercel preview kicks off.

- [ ] **Step 4: Wait for Vercel preview + smoke test**

Open the preview URL printed by `git push` (or `https://investa-<hash>-logomes-projects.vercel.app/imovel`).

Verify checklist:
1. Sidebar → Imóvel → KPIs aparecem (Yield Bruto ~7,83%, Líquido ~4,20%, Receita ~R$ 9.663, Custo ~R$ 8.338)
2. CostBreakdownCard mostra 6 itens com barras coloridas; soma bate com Custo Total
3. IncomeVsCostsCard mostra 5 barras (Bruto / Vacância / Custos op / IR / Líquido)
4. AcquisitionCostsCard: ITBI = R$ 11.500, Caução = R$ 4.500
5. RisksCard: 6 itens
6. EvolutionCard: linha do patrimônio sobe ao longo do horizonte
7. **Toggle financiamento no Drawer**:
   - Abrir Drawer → seção "Financiamento" com switch desligado
   - Ligar switch → 5 campos aparecem com defaults (30, 0,115, 0,20, SAC, 0,0005)
   - Aplicar cenário → FinancingCard aparece na aba
   - Parcela inicial ~R$ 2.187 (SAC); Total juros ~R$ 302k; Principal R$ 184k
   - LineChart de saldo devedor decresce de R$ 184k até zero
8. Console sem erros

- [ ] **Step 5: Merge to main**

```bash
git checkout main
git merge feat/fase4-imovel
git push origin main
```

- [ ] **Step 6: Cleanup branches**

```bash
git branch -d feat/fase4-imovel feat/fase4-imovel-spec
git push origin --delete feat/fase4-imovel feat/fase4-imovel-spec
```

- [ ] **Step 7: Smoke main em produção**

Verifique `https://investa-beta.vercel.app/imovel` após o deploy do main concluir (~2 min). Mesmo checklist do passo 4 deve passar.

---

## Done criteria

- 13 tarefas concluídas
- ~25-30 testes novos passando, suite total verde
- Aba `/imovel` em produção mostra todos os 6 blocos com defaults
- Toggle financiamento funciona end-to-end (drawer → store → aba)
- README atualizado, branches deletadas
- Próxima aba: Carteira (ordem natural Fase 4)
