# Aba Tributação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/tributacao/page.tsx` por uma aba de análise read-only que compara a carga tributária anual entre Imóvel e Carteira Diversificada, com KPIs + chart stacked + tabela + notas tributárias 2026.

**Architecture:** A aba consome `useSimulate()` do TanStack Query (cache compartilhado com Visão Geral / Sensibilidade). `data.taxComparison` traz 2 rows (Imóvel + Carteira) com gross/tax/net/burden. Tudo derivado client-side via `lib/tributacao-derive.ts` (puro). Chart e bar segments em SVG inline.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui (base-nova), TanStack Query v5, vitest, @testing-library/react.

**Branch base:** `feat/fase4-tributacao-spec` (já existe). Implementação em `feat/fase4-tributacao`.

**Spec:** `docs/superpowers/specs/2026-05-03-fase4-tributacao-design.md`.

---

## File Structure

**Cria:**
```
web/lib/tributacao-derive.ts                                 # splitTaxRows + taxDelta + TAX_NOTES + SCENARIO_COLORS
web/components/tributacao/TributacaoPageContent.tsx          # client wrapper (orchestrator)
web/components/tributacao/KpiRowTributacao.tsx               # bloco 1 — 4 KPIs
web/components/tributacao/TaxComparisonChart.tsx             # bloco 2 — barras stacked SVG
web/components/tributacao/TributacaoTable.tsx                # bloco 3 — tabela
web/components/tributacao/TaxNotesCard.tsx                   # bloco 4 — info-box notas
web/tests/tributacao-derive.test.ts                          # ~7 testes
web/tests/tributacao-page.test.tsx                           # ~5 smoke
```

**Modifica:**
```
web/app/tributacao/page.tsx                                  # placeholder → wire TributacaoPageContent
README.md                                                    # marca aba Tributação ✅
```

**Não toca:**
- `api/` — `/api/simulate` já retorna `taxComparison`; nenhuma alteração de backend
- Drawer — Tributação não tem inputs próprios
- `web/lib/api.ts` — `useSimulate` já existe

---

## Task 1: Branch + setup

**Files:** working directory state.

- [ ] **Step 1: Confirm starting state**

```bash
cd /home/lucgomes/workspace/investa
git status
git branch --show-current
```
Expected: branch `feat/fase4-tributacao-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-tributacao
```

- [ ] **Step 3: Confirm baseline**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run 2>&1 | tail -5
```
Expected: 25 test files, 140 tests passing (Renda Fixa + Imóvel + Carteira + Sensibilidade + drawer + derive).

---

## Task 2: `lib/tributacao-derive.ts` — splitTaxRows, taxDelta, TAX_NOTES (TDD)

**Files:**
- Create: `web/tests/tributacao-derive.test.ts`
- Create: `web/lib/tributacao-derive.ts`

- [ ] **Step 1: Write failing test file**

Create `web/tests/tributacao-derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  splitTaxRows,
  taxDelta,
  TAX_NOTES,
  SCENARIO_COLORS,
} from "@/lib/tributacao-derive";
import type { TaxComparisonRowOut } from "@/lib/api-types";

const RE_ROW: TaxComparisonRowOut = {
  scenario: "Imóvel",
  grossIncome: 18_000,
  annualTax: 1_237.5,
  netIncome: 16_762.5,
  effectiveTaxBurden: 0.0688,  // ~6,88%
};

const RE_FINANCED_ROW: TaxComparisonRowOut = {
  ...RE_ROW,
  scenario: "Imóvel (financiado)",
};

const PF_ROW: TaxComparisonRowOut = {
  scenario: "Carteira Diversificada",
  grossIncome: 27_945,
  annualTax: 414,
  netIncome: 27_531,
  effectiveTaxBurden: 0.0148,  // ~1,48%
};

describe("tributacao-derive — splitTaxRows", () => {
  it('localiza "Imóvel" e "Carteira Diversificada"', () => {
    const split = splitTaxRows([RE_ROW, PF_ROW]);
    expect(split.realEstate?.scenario).toBe("Imóvel");
    expect(split.portfolio?.scenario).toBe("Carteira Diversificada");
  });

  it('localiza "Imóvel (financiado)" pelo prefix', () => {
    const split = splitTaxRows([RE_FINANCED_ROW, PF_ROW]);
    expect(split.realEstate?.scenario).toBe("Imóvel (financiado)");
    expect(split.portfolio?.scenario).toBe("Carteira Diversificada");
  });

  it("retorna nulls quando array vazio", () => {
    expect(splitTaxRows([])).toEqual({ realEstate: null, portfolio: null });
  });

  it("retorna realEstate null se só houver carteira", () => {
    expect(splitTaxRows([PF_ROW])).toEqual({
      realEstate: null,
      portfolio: PF_ROW,
    });
  });
});

describe("tributacao-derive — taxDelta", () => {
  it("Imóvel paga mais imposto absoluto → realEstatePaysMore = true", () => {
    const d = taxDelta(RE_ROW, PF_ROW);
    expect(d.realEstatePaysMore).toBe(true);
    expect(d.taxDiffAbs).toBeCloseTo(1_237.5 - 414, 2);
  });

  it("Imóvel paga menos → realEstatePaysMore = false", () => {
    // Cenário invertido: imóvel isento vs carteira tributada
    const reIsento = { ...RE_ROW, annualTax: 0, effectiveTaxBurden: 0 };
    const pfHigh   = { ...PF_ROW, annualTax: 5_000, effectiveTaxBurden: 0.18 };
    const d = taxDelta(reIsento, pfHigh);
    expect(d.realEstatePaysMore).toBe(false);
    expect(d.taxDiffAbs).toBe(-5_000);
  });

  it("burdenDiffPp = re.effectiveTaxBurden - pf.effectiveTaxBurden", () => {
    const d = taxDelta(RE_ROW, PF_ROW);
    expect(d.burdenDiffPp).toBeCloseTo(0.0688 - 0.0148, 5);
  });
});

describe("tributacao-derive — TAX_NOTES + SCENARIO_COLORS", () => {
  it("TAX_NOTES tem 5 entradas com title + body não-vazios", () => {
    expect(TAX_NOTES).toHaveLength(5);
    TAX_NOTES.forEach((n) => {
      expect(n.title).toBeTruthy();
      expect(n.body).toBeTruthy();
    });
  });

  it("SCENARIO_COLORS expõe realEstate / portfolio / tax como hex válidos", () => {
    expect(SCENARIO_COLORS.realEstate).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.portfolio).toMatch(/^#[0-9A-F]{6}$/i);
    expect(SCENARIO_COLORS.tax).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/tributacao-derive.test.ts 2>&1 | tail -10
```
Expected: tests fail (module not found).

- [ ] **Step 3: Create implementation**

Create `web/lib/tributacao-derive.ts`:

```ts
import type { TaxComparisonRowOut } from "./api-types";

function isRealEstate(scenario: string): boolean {
  return scenario.toLowerCase().startsWith("imóvel");
}

function isPortfolio(scenario: string): boolean {
  return scenario === "Carteira Diversificada";
}

export function splitTaxRows(rows: TaxComparisonRowOut[]): {
  realEstate: TaxComparisonRowOut | null;
  portfolio:  TaxComparisonRowOut | null;
} {
  return {
    realEstate: rows.find((r) => isRealEstate(r.scenario)) ?? null,
    portfolio:  rows.find((r) => isPortfolio(r.scenario))  ?? null,
  };
}

export type TaxDelta = {
  taxDiffAbs:         number;
  burdenDiffPp:       number;
  realEstatePaysMore: boolean;
};

export function taxDelta(
  re: TaxComparisonRowOut,
  pf: TaxComparisonRowOut,
): TaxDelta {
  const taxDiffAbs   = re.annualTax - pf.annualTax;
  const burdenDiffPp = re.effectiveTaxBurden - pf.effectiveTaxBurden;
  return {
    taxDiffAbs,
    burdenDiffPp,
    realEstatePaysMore: taxDiffAbs > 0,
  };
}

export const SCENARIO_COLORS = {
  realEstate: "#FF6B5B",
  portfolio:  "#46E8A4",
  tax:        "#FF5D72",
} as const;

export const TAX_NOTES: Array<{ title: string; body: string }> = [
  {
    title: "FIIs",
    body: "Rendimentos mensais permanecem isentos para PF (ganho de capital na venda 20%).",
  },
  {
    title: "Ações BR — dividendos",
    body: "Isentos até R$ 50k/mês ou R$ 600k/ano por empresa.",
  },
  {
    title: "Ações US — dividendos",
    body: "30% retidos na fonte; tratado de bitributação pode reduzir.",
  },
  {
    title: "Aluguel (PF)",
    body: "Tabela progressiva via carnê-leão (0% a 27,5% conforme renda).",
  },
  {
    title: "Tesouro Direto",
    body: "Tabela regressiva sobre rendimentos: 22,5% (≤180d) → 15% (>720d).",
  },
];
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/tributacao-derive.test.ts 2>&1 | tail -10
```
Expected: ~10 tests pass (multiple `it` per `describe`).

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/tributacao-derive.ts web/tests/tributacao-derive.test.ts
git commit -m "feat(tributacao): add tributacao-derive lib (split rows, delta, notes, colors)"
```

---

## Task 3: `KpiRowTributacao.tsx`

**Files:**
- Create: `web/components/tributacao/KpiRowTributacao.tsx`

- [ ] **Step 1: Create directory + component**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/tributacao
```

Create `web/components/tributacao/KpiRowTributacao.tsx`:

```tsx
"use client";

import { Receipt, Wallet, Percent, Scale } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { taxDelta } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  realEstate: TaxComparisonRowOut;
  portfolio:  TaxComparisonRowOut;
};

export function KpiRowTributacao({ realEstate, portfolio }: Props) {
  const delta = taxDelta(realEstate, portfolio);
  const absDiff = Math.abs(delta.taxDiffAbs);
  const absBurden = Math.abs(delta.burdenDiffPp);
  const subDelta = delta.realEstatePaysMore
    ? `Imóvel paga +${formatPercent(absBurden, 2)} a mais`
    : `Carteira paga +${formatPercent(absBurden, 2)} a mais`;

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="Imposto Imóvel"
        value={formatRs(realEstate.annualTax)}
        icon={Receipt}
        valueColor="red"
        sub="anual"
      />
      <KpiCard
        label="Imposto Carteira"
        value={formatRs(portfolio.annualTax)}
        icon={Wallet}
        valueColor="green"
        sub="anual"
      />
      <KpiCard
        label="Carga efetiva Imóvel"
        value={formatPercent(realEstate.effectiveTaxBurden, 2)}
        icon={Percent}
        sub={`${formatPercent(portfolio.effectiveTaxBurden, 2)} carteira`}
      />
      <KpiCard
        label="Diferença"
        value={formatRs(absDiff)}
        icon={Scale}
        feature
        valueColor={delta.realEstatePaysMore ? "red" : "green"}
        sub={subDelta}
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
git add web/components/tributacao/KpiRowTributacao.tsx
git commit -m "feat(tributacao): add KpiRowTributacao with 3 absolutes + delta feature card"
```

---

## Task 4: `TaxComparisonChart.tsx` — SVG stacked horizontal

**Files:**
- Create: `web/components/tributacao/TaxComparisonChart.tsx`

- [ ] **Step 1: Create component**

Create `web/components/tributacao/TaxComparisonChart.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCENARIO_COLORS } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  realEstate: TaxComparisonRowOut;
  portfolio:  TaxComparisonRowOut;
};

const WIDTH = 720;
const HEIGHT = 170;
const PAD_LEFT = 130;
const PAD_RIGHT = 30;
const PAD_TOP = 20;
const ROW_HEIGHT = 60;
const BAR_HEIGHT = 32;
const COLOR_INK = "#eaf6f4";
const COLOR_INK3 = "#7d9591";

export function TaxComparisonChart({ realEstate, portfolio }: Props) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const maxGross = Math.max(realEstate.grossIncome, portfolio.grossIncome, 1);

  const rows = [
    { label: "Imóvel",   row: realEstate, color: SCENARIO_COLORS.realEstate },
    { label: "Carteira", row: portfolio,  color: SCENARIO_COLORS.portfolio },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Receita bruta vs imposto</h3>
      </CardHeader>
      <CardContent>
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Comparativo tributário">
          {rows.map((entry, i) => {
            const yCenter = PAD_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const yBar = yCenter - BAR_HEIGHT / 2;
            const wNet = (entry.row.netIncome / maxGross) * innerW;
            const wTax = (entry.row.annualTax / maxGross) * innerW;
            const xNet = PAD_LEFT;
            const xTax = PAD_LEFT + wNet;

            return (
              <g key={entry.label}>
                {/* Label esquerda */}
                <text
                  x={PAD_LEFT - 10}
                  y={yCenter + 4}
                  fill={COLOR_INK}
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {entry.label}
                </text>

                {/* Barra Líquido */}
                <rect
                  x={xNet}
                  y={yBar}
                  width={wNet}
                  height={BAR_HEIGHT}
                  fill={entry.color}
                  fillOpacity={0.85}
                />

                {/* Barra Imposto */}
                {wTax > 0 && (
                  <rect
                    x={xTax}
                    y={yBar}
                    width={wTax}
                    height={BAR_HEIGHT}
                    fill={SCENARIO_COLORS.tax}
                    fillOpacity={0.85}
                  />
                )}

                {/* Label sobre Líquido */}
                {wNet > 60 && (
                  <text
                    x={xNet + wNet / 2}
                    y={yCenter + 4}
                    fill={COLOR_INK}
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular"
                  >
                    {formatRs(entry.row.netIncome)}
                  </text>
                )}

                {/* Label sobre/após Imposto */}
                {wTax > 0 && (
                  <text
                    x={wTax > 80 ? xTax + wTax / 2 : xTax + wTax + 6}
                    y={yCenter + 4}
                    fill={wTax > 80 ? COLOR_INK : COLOR_INK3}
                    fontSize="11"
                    textAnchor={wTax > 80 ? "middle" : "start"}
                    className="tabular"
                  >
                    {formatRs(entry.row.annualTax)} ({formatPercent(entry.row.effectiveTaxBurden, 1)})
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.realEstate }} />
            Líquido Imóvel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.portfolio }} />
            Líquido Carteira
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.tax }} />
            Imposto
          </span>
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
git add web/components/tributacao/TaxComparisonChart.tsx
git commit -m "feat(tributacao): add TaxComparisonChart stacked horizontal SVG"
```

---

## Task 5: `TributacaoTable.tsx`

**Files:**
- Create: `web/components/tributacao/TributacaoTable.tsx`

- [ ] **Step 1: Create component**

Create `web/components/tributacao/TributacaoTable.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCENARIO_COLORS } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = { rows: TaxComparisonRowOut[] };

function bulletColor(scenario: string): string {
  if (scenario === "Carteira Diversificada") return SCENARIO_COLORS.portfolio;
  return SCENARIO_COLORS.realEstate;
}

export function TributacaoTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento</h3>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Cenário</th>
              <th className="text-right font-normal py-2 px-2">Receita Bruta</th>
              <th className="text-right font-normal py-2 px-2">Imposto Anual</th>
              <th className="text-right font-normal py-2 px-2">Receita Líquida</th>
              <th className="text-right font-normal py-2 pl-2">Carga Efetiva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scenario} className="border-b border-line-soft last:border-b-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: bulletColor(row.scenario) }}
                    />
                    <span className="text-ink truncate">{row.scenario}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.grossIncome)}</td>
                <td className="text-right py-2 px-2 tabular text-accent-coral">{formatRs(row.annualTax)}</td>
                <td className="text-right py-2 px-2 tabular text-accent-green">{formatRs(row.netIncome)}</td>
                <td className="text-right py-2 pl-2 tabular text-ink-2">{formatPercent(row.effectiveTaxBurden, 2)}</td>
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
git add web/components/tributacao/TributacaoTable.tsx
git commit -m "feat(tributacao): add TributacaoTable with bullet colors + sign-coded values"
```

---

## Task 6: `TaxNotesCard.tsx`

**Files:**
- Create: `web/components/tributacao/TaxNotesCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/tributacao/TaxNotesCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TAX_NOTES } from "@/lib/tributacao-derive";

export function TaxNotesCard() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Notas tributárias 2026</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {TAX_NOTES.map((n) => (
            <li key={n.title} className="text-[12px]">
              <span className="font-semibold text-ink">{n.title}</span>
              <span className="text-ink-3"> — {n.body}</span>
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
npx tsc --noEmit 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/tributacao/TaxNotesCard.tsx
git commit -m "feat(tributacao): add TaxNotesCard with 5 hardcoded 2026 tax notes"
```

---

## Task 7: `TributacaoPageContent.tsx` + wire route + smoke (TDD)

**Files:**
- Create: `web/components/tributacao/TributacaoPageContent.tsx`
- Create: `web/tests/tributacao-page.test.tsx`
- Modify: `web/app/tributacao/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/tributacao-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TributacaoPageContent } from "@/components/tributacao/TributacaoPageContent";
import type { SimulateOut } from "@/lib/api-types";

const fakeSimOut: SimulateOut = {
  realEstate: {} as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [] as never,
  taxComparison: [
    {
      scenario: "Imóvel",
      grossIncome: 18_000,
      annualTax: 1_237.5,
      netIncome: 16_762.5,
      effectiveTaxBurden: 0.0688,
    },
    {
      scenario: "Carteira Diversificada",
      grossIncome: 27_945,
      annualTax: 414,
      netIncome: 27_531,
      effectiveTaxBurden: 0.0148,
    },
  ],
};

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

describe("TributacaoPageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPIs Imposto Imóvel + Imposto Carteira", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/imposto imóvel/i)).toBeInTheDocument();
    expect(screen.getByText(/imposto carteira/i)).toBeInTheDocument();
    expect(screen.getByText(/diferença/i)).toBeInTheDocument();
  });

  it("renderiza chart svg com pelo menos 2 grupos (1 por cenário)", () => {
    const { container } = render(wrap(<TributacaoPageContent />));
    const svg = container.querySelector("svg[aria-label='Comparativo tributário']");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("g").length).toBe(2);
  });

  it("renderiza tabela com 2 cenários", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getAllByText(/Imóvel/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Carteira Diversificada/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza notas tributárias 2026", () => {
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/notas tributárias/i)).toBeInTheDocument();
    expect(screen.getByText("FIIs")).toBeInTheDocument();
    expect(screen.getByText("Aluguel (PF)")).toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<TributacaoPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<TributacaoPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/tributacao-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create TributacaoPageContent**

Create `web/components/tributacao/TributacaoPageContent.tsx`:

```tsx
"use client";

import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { splitTaxRows } from "@/lib/tributacao-derive";
import { KpiRowTributacao } from "./KpiRowTributacao";
import { TaxComparisonChart } from "./TaxComparisonChart";
import { TributacaoTable } from "./TributacaoTable";
import { TaxNotesCard } from "./TaxNotesCard";

export function TributacaoPageContent() {
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const { realEstate, portfolio } = splitTaxRows(data.taxComparison);

  if (!realEstate || !portfolio) {
    return <ErrorCard message="Dados de tributação incompletos" onRetry={() => sim.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <KpiRowTributacao realEstate={realEstate} portfolio={portfolio} />
      <TaxComparisonChart realEstate={realEstate} portfolio={portfolio} />
      <TributacaoTable rows={data.taxComparison} />
      <TaxNotesCard />
    </div>
  );
}
```

- [ ] **Step 4: Wire route**

Replace entire content of `web/app/tributacao/page.tsx`:

```tsx
import { TributacaoPageContent } from "@/components/tributacao/TributacaoPageContent";

export default function TributacaoPage() {
  return <TributacaoPageContent />;
}
```

- [ ] **Step 5: Run smoke + typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -3
npx vitest run tests/tributacao-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; 6 smoke tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 140 (baseline) + 10 (derive Task 2) + 6 (page smoke) = 156 tests passing.

- [ ] **Step 7: Run Next build**

```bash
cd /home/lucgomes/workspace/investa/web && pnpm run build 2>&1 | tail -15
```
Expected: build succeeds; `/tributacao` route ≥ a few KB.

- [ ] **Step 8: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/app/tributacao/page.tsx \
        web/components/tributacao/TributacaoPageContent.tsx \
        web/tests/tributacao-page.test.tsx
git commit -m "feat(tributacao): wire TributacaoPageContent + smoke tests"
```

---

## Task 8: README + push + smoke prod + merge

**Files:** `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find `- ⬜ Tributação` e substitua por:
```
  - ✅ Tributação (KPIs comparativos, chart stacked, tabela, notas 2026)
```

- [ ] **Step 2: Commit + push**

```bash
cd /home/lucgomes/workspace/investa
git add README.md
git commit -m "docs: mark aba Tributação complete"
git push -u origin feat/fase4-tributacao
```

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge feat/fase4-tributacao
git push origin main
```

- [ ] **Step 4: Smoke prod (após Vercel rebuild ~2 min)**

Open `https://investa-beta.vercel.app/tributacao`. Verify:

1. **4 KPIs**: Imposto Imóvel + Imposto Carteira + Carga efetiva Imóvel + Diferença (feature)
2. Card "Diferença" mostra valor absoluto, cor (red se Imóvel paga mais, green se Carteira paga mais), sub explicativo
3. **Chart**: 2 barras stacked horizontais com labels "Imóvel" / "Carteira", segmentos coloridos por cenário (líquido) + vermelho (imposto), legenda abaixo
4. **Tabela**: 2 linhas com bullet coerente, colunas Receita Bruta / Imposto / Líquida / Carga
5. **Notas 2026**: 5 bullets (FIIs, Ações BR, Ações US, Aluguel, Tesouro)
6. **Drawer**: alterar IR Imóvel / peso de FIIs e aplicar → KPIs e chart atualizam
7. Sem erros no console

- [ ] **Step 5: Cleanup branches**

```bash
git branch -d feat/fase4-tributacao feat/fase4-tributacao-spec
git push origin --delete feat/fase4-tributacao
```

---

## Done criteria

- 8 tasks concluídas
- ~16 testes novos (10 derive + 6 page); suite total ≥ 156
- Aba `/tributacao` em produção com KPIs + chart + tabela + notas
- README atualizado, branches deletadas
- Próxima aba: **Risco MC** (Monte Carlo, percentis, drawdown — última aba "analítica" da Fase 4)
