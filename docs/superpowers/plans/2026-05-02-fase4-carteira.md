# Aba Carteira — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/carteira/page.tsx` por uma aba de análise read-only da carteira diversificada com KPIs blended, donut SVG de alocação, tabela detalhamento, e yield comparison contra Imóvel + Tesouro Selic com refs Selic/IPCA.

**Architecture:** A aba lê `scenario.portfolio` + `scenario.realEstate` + `scenario.benchmark.taxRate` do `useScenarioStore` (Zustand) e `useMacro()` do TanStack Query. Tudo derivado client-side via `lib/carteira-derive.ts` (puro). SVG donut inline com geometria também em `carteira-derive.ts`. `lib/imovel-derive.ts` é importado para `grossYield`/`netYield` (paridade entre abas).

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui (base-nova), TanStack Query v5, Zustand v5, vitest, @testing-library/react.

**Branch base:** `feat/fase4-carteira-spec` (já existe). Implementação acontece em `feat/fase4-carteira`.

**Spec:** `docs/superpowers/specs/2026-05-02-fase4-carteira-design.md`.

---

## File Structure

**Cria:**
```
web/lib/carteira-derive.ts                                   # fórmulas + paleta + donut geometry
web/components/carteira/CarteiraPageContent.tsx              # client wrapper (orchestrator)
web/components/carteira/KpiRowCarteira.tsx                   # bloco 1
web/components/carteira/AllocationDonutCard.tsx              # bloco 2
web/components/carteira/AllocationTable.tsx                  # bloco 3
web/components/carteira/YieldComparisonCard.tsx              # bloco 4
web/tests/carteira-derive.test.ts                            # ~13 testes
web/tests/donut-slices.test.ts                               # ~5 testes
web/tests/carteira-page.test.tsx                             # ~5 smoke
```

**Modifica:**
```
web/app/carteira/page.tsx                                    # placeholder → wire CarteiraPageContent
README.md                                                    # marca aba Carteira ✅
```

**Não toca:**
- `api/` — engine `PortfolioParams` já está completo; nenhuma alteração de backend
- `web/lib/imovel-derive.ts` — apenas importado (`grossYield`, `netYield`)
- `web/components/scenario-drawer/` — Drawer já edita carteira via `PortfolioSection`

---

## Task 1: Branch + setup

**Files:** working directory state.

- [ ] **Step 1: Confirm starting state**

```bash
cd /home/lucgomes/workspace/investa
git status
git branch --show-current
```
Expected: branch `feat/fase4-carteira-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-carteira
```
Expected: switched to new branch.

- [ ] **Step 3: Confirm test runner baseline**

```bash
cd /home/lucgomes/workspace/investa/web
pnpm test --run 2>&1 | tail -10
```
Expected: 19 test files, 97 tests passing (Renda Fixa + Imóvel + drawer + derive).

---

## Task 2: `lib/carteira-derive.ts` — KPIs, segments, yield comparison, paleta (TDD)

**Files:**
- Create: `web/tests/carteira-derive.test.ts`
- Create: `web/lib/carteira-derive.ts`

This task implements everything EXCEPT donut geometry (which is Task 3).

- [ ] **Step 1: Write failing test file**

Create `web/tests/carteira-derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  blendedYield,
  blendedCapitalGain,
  totalReturn,
  annualIncome,
  normalizedWeights,
  allocationSegments,
  yieldComparison,
  yieldRefLines,
  ASSET_COLORS,
} from "@/lib/carteira-derive";
import type { PortfolioInput, RealEstateInput, MacroOut } from "@/lib/api-types";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

const PF: PortfolioInput = DEFAULT_SCENARIO.portfolio;
const RE: RealEstateInput = DEFAULT_SCENARIO.realEstate;
const MACRO: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

describe("carteira-derive — KPIs blended", () => {
  it("blendedYield ≈ 9,27% para defaults", () => {
    expect(blendedYield(PF)).toBeCloseTo(0.092725, 5);
  });

  it("blendedCapitalGain ≈ 2,0% para defaults", () => {
    expect(blendedCapitalGain(PF)).toBeCloseTo(0.020, 5);
  });

  it("totalReturn = blendedYield + blendedCapitalGain", () => {
    expect(totalReturn(PF)).toBeCloseTo(0.092725 + 0.020, 5);
  });

  it("annualIncome = capital × blendedYield", () => {
    expect(annualIncome(PF)).toBeCloseTo(21_326.75, 1);
  });

  it("annualIncome = 0 quando capital = 0", () => {
    expect(annualIncome({ ...PF, capital: 0 })).toBe(0);
  });

  it("IR=100% (taxRate=1) zera contribuição daquele asset ao blendedYield", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: [
        { name: "A", weight: 1.0, expectedYield: 0.10, capitalGain: 0, taxRate: 1.0, note: "", volatility: 0.1 },
      ],
    };
    expect(blendedYield(pf)).toBe(0);
  });
});

describe("carteira-derive — normalizedWeights", () => {
  it("pesos somando 1 ficam iguais", () => {
    expect(normalizedWeights(PF)).toEqual([0.25, 0.25, 0.20, 0.15, 0.15]);
  });

  it("pesos somando 2 são divididos por 2", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: a.weight * 2 })),
    };
    const w = normalizedWeights(pf);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    expect(w[0]).toBeCloseTo(0.25, 5);
  });

  it("pesos zerados retornam zeros (não NaN)", () => {
    const pf: PortfolioInput = {
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: 0 })),
    };
    expect(normalizedWeights(pf)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("carteira-derive — allocationSegments", () => {
  it("retorna 5 segmentos para defaults", () => {
    const segs = allocationSegments(PF);
    expect(segs).toHaveLength(5);
    expect(segs.map((s) => s.name)).toEqual([
      "FIIs de Papel",
      "FIIs de Tijolo",
      "Ações BR Dividendos",
      "Dividend Aristocrats US",
      "Tesouro IPCA+ / LCI",
    ]);
  });

  it("Σ weight = 1 e Σ amount = capital", () => {
    const segs = allocationSegments(PF);
    expect(segs.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 5);
    expect(segs.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(PF.capital, 1);
  });

  it("amount = capital × weight", () => {
    const segs = allocationSegments(PF);
    expect(segs[0].amount).toBe(57_500);  // 230k × 0.25
    expect(segs[3].amount).toBe(34_500);  // 230k × 0.15
  });

  it("netYield = expectedYield × (1 - taxRate)", () => {
    const segs = allocationSegments(PF);
    expect(segs[3].netYield).toBeCloseTo(0.04 * 0.7, 5);  // Dividend US: 4% × 70%
  });

  it("color usa ASSET_COLORS pelo índice", () => {
    const segs = allocationSegments(PF);
    expect(segs[0].color).toBe(ASSET_COLORS[0]);
    expect(segs[4].color).toBe(ASSET_COLORS[4]);
  });
});

describe("carteira-derive — yieldComparison", () => {
  it("retorna 4 entradas em ordem fixa", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.label)).toEqual([
      "Carteira blended",
      "Imóvel bruto",
      "Imóvel líquido",
      "Tesouro Selic líquido",
    ]);
  });

  it("Carteira blended bate com blendedYield(pf)", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows[0].value).toBeCloseTo(blendedYield(PF), 5);
  });

  it("Tesouro Selic líquido = selic × (1 - benchmarkTaxRate)", () => {
    const rows = yieldComparison({ pf: PF, re: RE, benchmarkTaxRate: 0.175, macro: MACRO });
    expect(rows[3].value).toBeCloseTo(0.1475 * 0.825, 5);
  });
});

describe("carteira-derive — yieldRefLines", () => {
  it("retorna Selic + IPCA do macro", () => {
    const lines = yieldRefLines(MACRO);
    expect(lines).toEqual([
      { label: "Selic", value: 0.1475 },
      { label: "IPCA", value: 0.0414 },
    ]);
  });
});

describe("carteira-derive — paleta", () => {
  it("ASSET_COLORS tem ao menos 5 entradas hex", () => {
    expect(ASSET_COLORS.length).toBeGreaterThanOrEqual(5);
    ASSET_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/i));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/carteira-derive.test.ts 2>&1 | tail -10
```
Expected: tests fail with "module not found".

- [ ] **Step 3: Create implementation**

Create `web/lib/carteira-derive.ts`:

```ts
import type { PortfolioInput, RealEstateInput, MacroOut } from "./api-types";
import { grossYield as imovelGrossYield, netYield as imovelNetYield } from "./imovel-derive";

// ---------- KPIs blended ----------

export function blendedYield(pf: PortfolioInput): number {
  return pf.assets.reduce(
    (sum, a) => sum + a.weight * a.expectedYield * (1 - a.taxRate),
    0,
  );
}

export function blendedCapitalGain(pf: PortfolioInput): number {
  return pf.assets.reduce((sum, a) => sum + a.weight * a.capitalGain, 0);
}

export function totalReturn(pf: PortfolioInput): number {
  return blendedYield(pf) + blendedCapitalGain(pf);
}

export function annualIncome(pf: PortfolioInput): number {
  return pf.capital * blendedYield(pf);
}

// ---------- Pesos ----------

export function normalizedWeights(pf: PortfolioInput): number[] {
  const sum = pf.assets.reduce((s, a) => s + a.weight, 0);
  if (sum <= 0) return pf.assets.map(() => 0);
  return pf.assets.map((a) => a.weight / sum);
}

// ---------- Allocation segments ----------

export type AllocationSegment = {
  name: string;
  weight: number;
  amount: number;
  expectedYield: number;
  taxRate: number;
  netYield: number;
  color: string;
};

export function allocationSegments(pf: PortfolioInput): AllocationSegment[] {
  const weights = normalizedWeights(pf);
  return pf.assets.map((a, i) => ({
    name: a.name,
    weight: weights[i],
    amount: pf.capital * weights[i],
    expectedYield: a.expectedYield,
    taxRate: a.taxRate,
    netYield: a.expectedYield * (1 - a.taxRate),
    color: ASSET_COLORS[i % ASSET_COLORS.length],
  }));
}

// ---------- Yield comparison ----------

export type YieldRow = { label: string; value: number; color: string };

export function yieldComparison(args: {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;
  macro: MacroOut;
}): YieldRow[] {
  const { pf, re, benchmarkTaxRate, macro } = args;
  return [
    { label: "Carteira blended",      value: blendedYield(pf),                   color: "#46E8A4" },
    { label: "Imóvel bruto",          value: imovelGrossYield(re),               color: "#FFC857" },
    { label: "Imóvel líquido",        value: imovelNetYield(re),                 color: "#FF6B5B" },
    { label: "Tesouro Selic líquido", value: macro.selic * (1 - benchmarkTaxRate), color: "#5CC8FF" },
  ];
}

export type RefLine = { label: string; value: number };

export function yieldRefLines(macro: MacroOut): RefLine[] {
  return [
    { label: "Selic", value: macro.selic },
    { label: "IPCA",  value: macro.ipca },
  ];
}

// ---------- Paleta ----------

export const ASSET_COLORS: string[] = [
  "#FFC857",  // 0 — amber
  "#FF6B5B",  // 1 — coral
  "#5CC8FF",  // 2 — cyan
  "#46E8A4",  // 3 — green
  "#C39BD3",  // 4 — purple
  "#FFB088",  // 5 — fallback
  "#7DCFFF",  // 6 — fallback
  "#A2E5C0",  // 7 — fallback
];
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/carteira-derive.test.ts 2>&1 | tail -10
```
Expected: ~13 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/carteira-derive.ts web/tests/carteira-derive.test.ts
git commit -m "feat(carteira): add carteira-derive lib (KPIs blended, segments, yield comparison)"
```

---

## Task 3: `donutSlices` em `carteira-derive.ts` — geometria SVG (TDD)

**Files:**
- Create: `web/tests/donut-slices.test.ts`
- Modify: `web/lib/carteira-derive.ts` (append `donutSlices` + `DonutSlice` type)

- [ ] **Step 1: Write failing test file**

Create `web/tests/donut-slices.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { donutSlices, allocationSegments, ASSET_COLORS } from "@/lib/carteira-derive";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

const PF = DEFAULT_SCENARIO.portfolio;

describe("donutSlices", () => {
  it("retorna um slice por segmento não-zero", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(5);
  });

  it("filtra segmentos com weight = 0", () => {
    const segs = allocationSegments({
      ...PF,
      assets: PF.assets.map((a, i) => ({ ...a, weight: i === 0 ? 0 : a.weight })),
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(4);
  });

  it("midAngle de 1 segmento (weight=1) está em 0 (topo)", () => {
    // Convenção: começa em -π/2 (topo). midAngle de slice de 360° é em 0 rad = lateral direita.
    // O algoritmo usa convenção "starts at -π/2", então midAngle = -π/2 + π = π/2 (lateral baixo)
    // Na prática: testamos só que o path existe e tem 2 arcos.
    const segs = allocationSegments({
      ...PF,
      assets: [{ name: "Solo", weight: 1.0, expectedYield: 0.1, capitalGain: 0, taxRate: 0, note: "", volatility: 0.1 }],
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    expect(slices).toHaveLength(1);
    // Path com 2 arcos = ao menos 2 ocorrências de "A " (SVG arc command)
    const arcCount = (slices[0].path.match(/A /g) ?? []).length;
    expect(arcCount).toBeGreaterThanOrEqual(2);
  });

  it("5 segmentos uniformes têm midAngle distribuídos a cada 72°", () => {
    const segs = allocationSegments({
      ...PF,
      assets: PF.assets.map((a) => ({ ...a, weight: 0.2 })),
    });
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    // Diferença entre midAngles consecutivos deve ser ~72° (2π/5 rad = 1.2566)
    for (let i = 1; i < slices.length; i++) {
      const diff = slices[i].midAngle - slices[i - 1].midAngle;
      expect(diff).toBeCloseTo((2 * Math.PI) / 5, 4);
    }
  });

  it("color do slice corresponde ao color do segmento", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    slices.forEach((s, i) => {
      expect(s.color).toBe(ASSET_COLORS[i]);
    });
  });

  it("path começa com M e termina com Z", () => {
    const segs = allocationSegments(PF);
    const slices = donutSlices({ segments: segs, cx: 140, cy: 140, outerR: 110, innerR: 70 });
    slices.forEach((s) => {
      expect(s.path.startsWith("M ")).toBe(true);
      expect(s.path.trimEnd().endsWith("Z")).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/donut-slices.test.ts 2>&1 | tail -10
```
Expected: fails (donutSlices not exported).

- [ ] **Step 3: Append `donutSlices` and `DonutSlice` to `web/lib/carteira-derive.ts`**

Append at the end of the file:

```ts
// ---------- Donut geometry ----------

export type DonutSlice = {
  path: string;
  color: string;
  midAngle: number;
};

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  // SVG y axis is inverted: cos for y to match screen coordinates with -π/2 at top
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export function donutSlices(args: {
  segments: AllocationSegment[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
}): DonutSlice[] {
  const { segments, cx, cy, outerR, innerR } = args;
  const visible = segments.filter((s) => s.weight > 0);
  const slices: DonutSlice[] = [];

  // Start at -π/2 (top of circle)
  let cumulative = -HALF_PI;

  for (const seg of visible) {
    const sweep = seg.weight * TWO_PI;
    const start = cumulative;
    const end = cumulative + sweep;
    const mid = (start + end) / 2;

    let path: string;

    if (seg.weight >= 1 - 1e-9) {
      // Full ring — split into two 180° arcs to avoid degenerate full arc
      const top = polar(cx, cy, outerR, -HALF_PI);
      const bot = polar(cx, cy, outerR, HALF_PI);
      const topInner = polar(cx, cy, innerR, -HALF_PI);
      const botInner = polar(cx, cy, innerR, HALF_PI);
      path =
        `M ${top[0]} ${top[1]} ` +
        `A ${outerR} ${outerR} 0 1 1 ${bot[0]} ${bot[1]} ` +
        `A ${outerR} ${outerR} 0 1 1 ${top[0]} ${top[1]} ` +
        `L ${topInner[0]} ${topInner[1]} ` +
        `A ${innerR} ${innerR} 0 1 0 ${botInner[0]} ${botInner[1]} ` +
        `A ${innerR} ${innerR} 0 1 0 ${topInner[0]} ${topInner[1]} ` +
        `Z`;
    } else {
      const largeArc = sweep > Math.PI ? 1 : 0;
      const [x0o, y0o] = polar(cx, cy, outerR, start);
      const [x1o, y1o] = polar(cx, cy, outerR, end);
      const [x0i, y0i] = polar(cx, cy, innerR, end);
      const [x1i, y1i] = polar(cx, cy, innerR, start);
      path =
        `M ${x0o} ${y0o} ` +
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o} ` +
        `L ${x0i} ${y0i} ` +
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i} ` +
        `Z`;
    }

    slices.push({ path, color: seg.color, midAngle: mid });
    cumulative = end;
  }

  return slices;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/donut-slices.test.ts 2>&1 | tail -10
```
Expected: 6 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 97 + 13 + 6 = 116 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/carteira-derive.ts web/tests/donut-slices.test.ts
git commit -m "feat(carteira): add donutSlices SVG geometry (filter zeros, split full ring)"
```

---

## Task 4: `KpiRowCarteira.tsx`

**Files:**
- Create: `web/components/carteira/KpiRowCarteira.tsx`

- [ ] **Step 1: Create directory + component**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/carteira
```

Create `web/components/carteira/KpiRowCarteira.tsx`:

```tsx
"use client";

import { TrendingUp, ArrowUpRight, BarChart3, Wallet } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import {
  blendedYield, blendedCapitalGain, totalReturn, annualIncome,
} from "@/lib/carteira-derive";
import { formatPercent, formatRs } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function KpiRowCarteira({ pf }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="DY blended"
        value={formatPercent(blendedYield(pf), 2)}
        icon={TrendingUp}
        sub="líquido após IR"
      />
      <KpiCard
        label="Ganho de capital esp."
        value={formatPercent(blendedCapitalGain(pf), 2)}
        icon={ArrowUpRight}
        sub="valorização ponderada"
      />
      <KpiCard
        label="Retorno total a.a."
        value={formatPercent(totalReturn(pf), 2)}
        icon={BarChart3}
        feature
        valueColor="green"
      />
      <KpiCard
        label="Renda anual estimada"
        value={formatRs(annualIncome(pf))}
        icon={Wallet}
        sub="capital × DY"
      />
    </div>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
cd /home/lucgomes/workspace/investa/web && npx tsc --noEmit 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/carteira/KpiRowCarteira.tsx
git commit -m "feat(carteira): add KpiRowCarteira (4 KPIs blended)"
```

---

## Task 5: `AllocationDonutCard.tsx`

**Files:**
- Create: `web/components/carteira/AllocationDonutCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/carteira/AllocationDonutCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { allocationSegments, donutSlices } from "@/lib/carteira-derive";
import { formatRsK, formatPercent } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function AllocationDonutCard({ pf }: Props) {
  const segments = allocationSegments(pf);
  const slices = donutSlices({ segments, cx: 140, cy: 140, outerR: 110, innerR: 70 });

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Alocação por classe</h3>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <svg width={280} height={280} viewBox="0 0 280 280" role="img" aria-label="Alocação da carteira">
            {slices.map((slice, i) => (
              <path key={i} d={slice.path} fill={slice.color} />
            ))}
            <text x={140} y={138} textAnchor="middle" fontSize={22} fontWeight={700} fill="#eaf6f4">
              {formatRsK(pf.capital)}
            </text>
            <text x={140} y={156} textAnchor="middle" fontSize={11} fill="#7d9591">
              alocados
            </text>
          </svg>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
            {segments.map((seg) => (
              <div key={seg.name} className="flex items-center gap-2 text-[11px]">
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-ink truncate flex-1">{seg.name}</span>
                <span className="text-ink-3 tabular">{formatPercent(seg.weight, 1)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/carteira/AllocationDonutCard.tsx
git commit -m "feat(carteira): add AllocationDonutCard with SVG donut + legend"
```

---

## Task 6: `AllocationTable.tsx`

**Files:**
- Create: `web/components/carteira/AllocationTable.tsx`

- [ ] **Step 1: Create component**

Create `web/components/carteira/AllocationTable.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { allocationSegments } from "@/lib/carteira-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function AllocationTable({ pf }: Props) {
  const segments = allocationSegments(pf);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento por classe</h3>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Classe</th>
              <th className="text-right font-normal py-2 px-2">Peso</th>
              <th className="text-right font-normal py-2 px-2">Valor</th>
              <th className="text-right font-normal py-2 px-2">Yield esp.</th>
              <th className="text-right font-normal py-2 pl-2">IR</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg.name} className="border-b border-line-soft last:border-b-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-ink truncate">{seg.name}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 tabular text-ink-2">{formatPercent(seg.weight, 1)}</td>
                <td className="text-right py-2 px-2 tabular text-ink">{formatRs(seg.amount)}</td>
                <td className="text-right py-2 px-2 tabular text-ink-2">{formatPercent(seg.expectedYield, 2)}</td>
                <td className="text-right py-2 pl-2 tabular text-ink-3">{formatPercent(seg.taxRate, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/carteira/AllocationTable.tsx
git commit -m "feat(carteira): add AllocationTable with bullet color matching donut"
```

---

## Task 7: `YieldComparisonCard.tsx`

**Files:**
- Create: `web/components/carteira/YieldComparisonCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/carteira/YieldComparisonCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { yieldComparison, yieldRefLines } from "@/lib/carteira-derive";
import { formatPercent } from "@/lib/format";
import type { PortfolioInput, RealEstateInput, MacroOut } from "@/lib/api-types";

type Props = {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;
  macro: MacroOut;
};

export function YieldComparisonCard({ pf, re, benchmarkTaxRate, macro }: Props) {
  const rows = yieldComparison({ pf, re, benchmarkTaxRate, macro });
  const refs = yieldRefLines(macro);
  const allValues = [...rows.map((r) => r.value), ...refs.map((r) => r.value)];
  const xMax = Math.max(...allValues, 0.01) + 0.02;  // 2pp folga

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Comparativo de yields</h3>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-2 pt-6 pb-2">
          {/* Reference lines (vertical, dashed, full chart height) */}
          <div className="absolute inset-x-[160px] top-0 bottom-2 pointer-events-none">
            {refs.map((ref) => {
              const left = (ref.value / xMax) * 100;
              return (
                <div
                  key={ref.label}
                  className="absolute top-0 bottom-0 border-l border-dashed border-ink-4/60"
                  style={{ left: `${left}%` }}
                >
                  <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-ink-3 whitespace-nowrap">
                    {ref.label} {formatPercent(ref.value, 2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bars */}
          {rows.map((row) => {
            const width = (row.value / xMax) * 100;
            return (
              <div key={row.label} className="grid grid-cols-[160px_1fr_70px] items-center gap-2 h-7 relative">
                <span className="text-[12px] text-ink truncate">{row.label}</span>
                <div className="h-2.5 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: row.color }}
                  />
                </div>
                <span className="text-[12px] text-ink tabular text-right">{formatPercent(row.value, 2)}</span>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-ink-4 mt-3">
          Linhas tracejadas = referência macro atual.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Confirm typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/carteira/YieldComparisonCard.tsx
git commit -m "feat(carteira): add YieldComparisonCard with 4 bars + Selic/IPCA refs"
```

---

## Task 8: `CarteiraPageContent.tsx` + wire route + smoke (TDD)

**Files:**
- Create: `web/components/carteira/CarteiraPageContent.tsx`
- Create: `web/tests/carteira-page.test.tsx`
- Modify: `web/app/carteira/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/carteira-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CarteiraPageContent } from "@/components/carteira/CarteiraPageContent";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { MacroOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: typeof DEFAULT_SCENARIO }) => T) =>
    selector({ scenario: DEFAULT_SCENARIO }),
}));

const fakeMacro: MacroOut = {
  selic: 0.1475,
  cdi: 0.1465,
  ipca: 0.0414,
  usdBrl: 5.30,
  isStale: false,
  sourceLabel: "test",
};

let mockMacroReturn: { data: MacroOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: undefined, isLoading: false, error: null }),
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => mockMacroReturn,
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("CarteiraPageContent", () => {
  beforeEach(() => {
    mockMacroReturn = { data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs blended e barras de comparação", () => {
    render(wrap(<CarteiraPageContent />));
    expect(screen.getByText(/dy blended/i)).toBeInTheDocument();
    expect(screen.getByText(/retorno total/i)).toBeInTheDocument();
    expect(screen.getByText(/carteira blended/i)).toBeInTheDocument();
    expect(screen.getByText(/imóvel bruto/i)).toBeInTheDocument();
    expect(screen.getByText(/tesouro selic líquido/i)).toBeInTheDocument();
  });

  it("renderiza svg do donut", () => {
    const { container } = render(wrap(<CarteiraPageContent />));
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("path").length).toBeGreaterThanOrEqual(5);
  });

  it("renderiza tabela de detalhamento com 5 classes", () => {
    render(wrap(<CarteiraPageContent />));
    expect(screen.getByText("FIIs de Papel")).toBeInTheDocument();
    expect(screen.getByText("Tesouro IPCA+ / LCI")).toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockMacroReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<CarteiraPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockMacroReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<CarteiraPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/carteira-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create CarteiraPageContent**

Create `web/components/carteira/CarteiraPageContent.tsx`:

```tsx
"use client";

import { useScenarioStore } from "@/lib/store";
import { useMacro } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { KpiRowCarteira } from "./KpiRowCarteira";
import { AllocationDonutCard } from "./AllocationDonutCard";
import { AllocationTable } from "./AllocationTable";
import { YieldComparisonCard } from "./YieldComparisonCard";

export function CarteiraPageContent() {
  const scenario = useScenarioStore((s) => s.scenario);
  const macro = useMacro();

  if (macro.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (macro.error) {
    return <ErrorCard onRetry={() => macro.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <KpiRowCarteira pf={scenario.portfolio} />
      <div className="grid grid-cols-2 gap-6">
        <AllocationDonutCard pf={scenario.portfolio} />
        <AllocationTable pf={scenario.portfolio} />
      </div>
      <YieldComparisonCard
        pf={scenario.portfolio}
        re={scenario.realEstate}
        benchmarkTaxRate={scenario.benchmark.taxRate}
        macro={macro.data!}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire route**

Replace entire content of `web/app/carteira/page.tsx`:

```tsx
import { CarteiraPageContent } from "@/components/carteira/CarteiraPageContent";

export default function CarteiraPage() {
  return <CarteiraPageContent />;
}
```

- [ ] **Step 5: Run tests + typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -3
npx vitest run tests/carteira-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; 5 smoke tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 116 (after Task 3) + 5 = 121 tests passing.

- [ ] **Step 7: Run Next build (catches ESLint stricter than tsc)**

```bash
cd /home/lucgomes/workspace/investa/web && pnpm run build 2>&1 | tail -10
```
Expected: build succeeds; `/carteira` route shows up in the route list.

- [ ] **Step 8: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/app/carteira/page.tsx \
        web/components/carteira/CarteiraPageContent.tsx \
        web/tests/carteira-page.test.tsx
git commit -m "feat(carteira): wire CarteiraPageContent + smoke tests"
```

---

## Task 9: README + push + smoke prod + merge

**Files:** `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find `- ⬜ Carteira` under Fase 4 and replace with:
```
  - ✅ Carteira (KPIs blended, donut, tabela detalhamento, yield comparison)
```

- [ ] **Step 2: Commit README**

```bash
cd /home/lucgomes/workspace/investa
git add README.md
git commit -m "docs: mark aba Carteira complete"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/fase4-carteira
```
Expected: branch pushed.

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git merge feat/fase4-carteira
git push origin main
```

- [ ] **Step 5: Smoke prod after Vercel rebuild (~2 min)**

Open `https://investa-beta.vercel.app/carteira`. Verify:

1. KPIs visíveis: DY blended **9,27%**, Ganho capital **2,00%**, Retorno total **11,27%** (verde, featured), Renda anual **R$ 21.327**
2. Donut: 5 fatias coloridas com `R$ 230k` no centro + "alocados" abaixo
3. Legenda do donut: 5 itens com bullet colorido + nome + peso% (25,0% / 25,0% / 20,0% / 15,0% / 15,0%)
4. Tabela: 5 linhas com bullet coerente + valores corretos (R$ 57.500 / R$ 57.500 / R$ 46.000 / R$ 34.500 / R$ 34.500)
5. Yield comparison: 4 barras (Carteira ~9,27%, Imóvel bruto ~7,83%, Imóvel líquido ~4,20%, Tesouro Selic líq ~12,17%)
6. Linhas tracejadas Selic 14,75% e IPCA ~4,14% visíveis
7. Drawer → mexer no peso de FIIs Papel (ex: 0.30) → KPIs e donut atualizam ao aplicar
8. Sem erros no console

- [ ] **Step 6: Cleanup branches**

```bash
git branch -d feat/fase4-carteira feat/fase4-carteira-spec
git push origin --delete feat/fase4-carteira
```
(Spec branch was never pushed, ignore the remote-delete error for it.)

---

## Done criteria

- 9 tasks concluídas
- ~24 testes novos (13 derive + 6 donut + 5 page) passando, suite total ≥ 121
- Aba `/carteira` em produção com KPIs blended, donut, tabela e yield comparison
- README atualizado, branch deletada
- Próxima aba: **Sensibilidade** (ou outra na ordem natural Fase 4)
