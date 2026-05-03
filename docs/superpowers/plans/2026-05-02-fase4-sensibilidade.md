# Aba Sensibilidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/sensibilidade/page.tsx` por uma aba de análise read-only que mostra como o patrimônio do Imóvel responde à variação de 6 parâmetros, via KPI banner + tornado chart + tabela detalhada.

**Architecture:** A aba consome `useSimulate()` do TanStack Query (já compartilhado com Visão Geral, hit de cache na maioria das visitas). `data.sensitivity` traz os 6 rows (parameter / pessimistic / optimistic) e `data.realEstate.patrimony[N−1]` é o base. Tudo derivado client-side via `lib/sensibilidade-derive.ts` (puro). Tornado renderiza em SVG inline.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui (base-nova), TanStack Query v5, Zustand v5, vitest, @testing-library/react.

**Branch base:** `feat/fase4-sensibilidade-spec` (já existe). Implementação em `feat/fase4-sensibilidade`.

**Spec:** `docs/superpowers/specs/2026-05-02-fase4-sensibilidade-design.md`.

---

## File Structure

**Cria:**
```
web/lib/sensibilidade-derive.ts                              # PARAMETER_LABELS + enrich + sort + bounds
web/components/sensibilidade/SensibilidadePageContent.tsx    # client wrapper (orchestrator)
web/components/sensibilidade/KpiBaseCard.tsx                 # bloco 1 — banner KPI
web/components/sensibilidade/TornadoChart.tsx                # bloco 2 — SVG tornado
web/components/sensibilidade/SensibilidadeTable.tsx          # bloco 3 — tabela
web/tests/sensibilidade-derive.test.ts                       # ~8 testes
web/tests/sensibilidade-page.test.tsx                        # ~5 smoke
```

**Modifica:**
```
web/app/sensibilidade/page.tsx                               # placeholder → wire SensibilidadePageContent
README.md                                                    # marca aba Sensibilidade ✅
```

**Não toca:**
- `api/` — `/api/simulate` já retorna `sensitivity`; nenhuma alteração de backend
- Drawer — Sensibilidade não tem inputs próprios
- `web/lib/api.ts` — `useSimulate` já existe e é reutilizado

---

## Task 1: Branch + setup

**Files:** working directory state.

- [ ] **Step 1: Confirm starting state**

```bash
cd /home/lucgomes/workspace/investa
git status
git branch --show-current
```
Expected: branch `feat/fase4-sensibilidade-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-sensibilidade
```

- [ ] **Step 3: Confirm baseline**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run 2>&1 | tail -5
```
Expected: 23 test files, 127 tests passing (Renda Fixa + Imóvel + Carteira + drawer + derive).

---

## Task 2: `lib/sensibilidade-derive.ts` — labels, enrich, sort, bounds (TDD)

**Files:**
- Create: `web/tests/sensibilidade-derive.test.ts`
- Create: `web/lib/sensibilidade-derive.ts`

- [ ] **Step 1: Write failing test file**

Create `web/tests/sensibilidade-derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PARAMETER_LABELS,
  paramLabel,
  enrichRows,
  sortByImpact,
  tornadoBounds,
} from "@/lib/sensibilidade-derive";
import type { SensitivityRowOut } from "@/lib/api-types";

const SAMPLE: SensitivityRowOut[] = [
  { parameter: "monthly_rent",            pessimistic: 320_000, optimistic: 470_000 },  // amplitude 150k
  { parameter: "annual_appreciation",     pessimistic: 340_000, optimistic: 450_000 },  // amplitude 110k
  { parameter: "vacancy_months_per_year", pessimistic: 410_000, optimistic: 380_000 },  // amplitude -30k → abs 30k
  { parameter: "management_fee_pct",      pessimistic: 400_000, optimistic: 385_000 },
  { parameter: "iptu_rate",               pessimistic: 395_000, optimistic: 390_000 },
  { parameter: "income_tax_bracket",      pessimistic: 393_000, optimistic: 392_500 },
];

const BASE = 393_000;

describe("sensibilidade-derive — paramLabel", () => {
  it("traduz parameter conhecido", () => {
    expect(paramLabel("monthly_rent")).toBe("Aluguel mensal (±20%)");
    expect(paramLabel("vacancy_months_per_year")).toBe("Vacância (0–3 meses)");
  });

  it("retorna parameter cru para chave desconhecida (fallback)", () => {
    expect(paramLabel("foo_bar")).toBe("foo_bar");
  });

  it("PARAMETER_LABELS cobre os 6 parâmetros padrão do backend", () => {
    expect(Object.keys(PARAMETER_LABELS).sort()).toEqual([
      "annual_appreciation",
      "income_tax_bracket",
      "iptu_rate",
      "management_fee_pct",
      "monthly_rent",
      "vacancy_months_per_year",
    ]);
  });
});

describe("sensibilidade-derive — enrichRows", () => {
  it("calcula impactos e amplitude corretamente", () => {
    const enriched = enrichRows(SAMPLE.slice(0, 1), BASE);
    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      parameter: "monthly_rent",
      label: "Aluguel mensal (±20%)",
      pessimistic: 320_000,
      optimistic: 470_000,
      base: 393_000,
      pessImpact: 320_000 - 393_000,        // -73_000
      optImpact: 470_000 - 393_000,         // +77_000
      amplitude: 470_000 - 320_000,         // 150_000
    });
  });

  it("array vazio → retorna vazio", () => {
    expect(enrichRows([], BASE)).toEqual([]);
  });
});

describe("sensibilidade-derive — sortByImpact", () => {
  it("ordena por amplitude descendente (não muta o array original)", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    const sorted = sortByImpact(enriched);
    expect(sorted.map((r) => r.parameter)).toEqual([
      "monthly_rent",            // amplitude 150k
      "annual_appreciation",     // amplitude 110k
      "vacancy_months_per_year", // 30k
      "management_fee_pct",      // 15k
      "iptu_rate",               // 5k
      "income_tax_bracket",      // 0.5k
    ]);
    // verifica não-mutação
    expect(enriched[0].parameter).toBe("monthly_rent");
  });
});

describe("sensibilidade-derive — tornadoBounds", () => {
  it("retorna range simétrico em torno do base", () => {
    const enriched = enrichRows(SAMPLE, BASE);
    const { min, max } = tornadoBounds(enriched, BASE);
    // maior desvio absoluto: |320k - 393k| = 73k
    // pad 5%: 73k * 1.05 = 76_650
    expect(min).toBeCloseTo(BASE - 76_650, -1);
    expect(max).toBeCloseTo(BASE + 76_650, -1);
    // simetria
    expect(BASE - min).toBeCloseTo(max - BASE, 0);
  });

  it("array vazio → fallback ±10% do base", () => {
    expect(tornadoBounds([], 100_000)).toEqual({ min: 90_000, max: 110_000 });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/sensibilidade-derive.test.ts 2>&1 | tail -10
```
Expected: tests fail with "module not found".

- [ ] **Step 3: Create implementation**

Create `web/lib/sensibilidade-derive.ts`:

```ts
import type { SensitivityRowOut } from "./api-types";

// Espelha _build_sensitivity_deltas em api/routers/simulation.py.
// Mantenha em sincronia com o backend caso novos parâmetros sejam adicionados.
export const PARAMETER_LABELS: Record<string, string> = {
  monthly_rent:            "Aluguel mensal (±20%)",
  annual_appreciation:     "Valorização (±3pp)",
  vacancy_months_per_year: "Vacância (0–3 meses)",
  management_fee_pct:      "Adm. imobiliária (0–15%)",
  iptu_rate:               "IPTU (0,5–2%)",
  income_tax_bracket:      "Faixa IR (0–27,5%)",
};

export function paramLabel(parameter: string): string {
  return PARAMETER_LABELS[parameter] ?? parameter;
}

export type SensitivityRow = {
  parameter: string;
  label: string;
  pessimistic: number;
  optimistic: number;
  base: number;
  pessImpact: number;       // pessimistic - base
  optImpact: number;        // optimistic - base
  amplitude: number;        // |optimistic - pessimistic| — sempre >= 0
};

export function enrichRows(
  rows: SensitivityRowOut[],
  base: number,
): SensitivityRow[] {
  return rows.map((r) => ({
    parameter:   r.parameter,
    label:       paramLabel(r.parameter),
    pessimistic: r.pessimistic,
    optimistic:  r.optimistic,
    base,
    pessImpact:  r.pessimistic - base,
    optImpact:   r.optimistic - base,
    amplitude:   Math.abs(r.optimistic - r.pessimistic),
  }));
}

export function sortByImpact(rows: SensitivityRow[]): SensitivityRow[] {
  return [...rows].sort((a, b) => b.amplitude - a.amplitude);
}

export function tornadoBounds(
  rows: SensitivityRow[],
  base: number,
): { min: number; max: number } {
  if (rows.length === 0) return { min: base * 0.9, max: base * 1.1 };
  const maxDeviation = Math.max(
    ...rows.map((r) => Math.max(Math.abs(r.pessImpact), Math.abs(r.optImpact))),
  );
  const padded = maxDeviation * 1.05;
  return { min: base - padded, max: base + padded };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/sensibilidade-derive.test.ts 2>&1 | tail -10
```
Expected: ~8 tests pass (multiple `it` per `describe`).

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/sensibilidade-derive.ts web/tests/sensibilidade-derive.test.ts
git commit -m "feat(sensibilidade): add sensibilidade-derive lib (labels, enrich, sort, bounds)"
```

---

## Task 3: `KpiBaseCard.tsx`

**Files:**
- Create: `web/components/sensibilidade/KpiBaseCard.tsx`

- [ ] **Step 1: Create directory + component**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/sensibilidade
```

Create `web/components/sensibilidade/KpiBaseCard.tsx`:

```tsx
"use client";

import { Target } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { formatRs } from "@/lib/format";

type Props = { base: number; horizonYears: number };

export function KpiBaseCard({ base, horizonYears }: Props) {
  return (
    <div className="grid grid-cols-1">
      <KpiCard
        label={`Patrimônio Imóvel ao fim de ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
        value={formatRs(base)}
        icon={Target}
        feature
        valueColor="green"
        sub="cenário base — variações abaixo"
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
git add web/components/sensibilidade/KpiBaseCard.tsx
git commit -m "feat(sensibilidade): add KpiBaseCard banner with base patrimony"
```

---

## Task 4: `TornadoChart.tsx` — SVG tornado

**Files:**
- Create: `web/components/sensibilidade/TornadoChart.tsx`

- [ ] **Step 1: Create component**

Create `web/components/sensibilidade/TornadoChart.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { tornadoBounds, type SensitivityRow } from "@/lib/sensibilidade-derive";
import { formatRs, formatRsK } from "@/lib/format";

type Props = { rows: SensitivityRow[]; base: number };

const ROW_HEIGHT = 38;
const PAD_LEFT = 170;
const PAD_RIGHT = 100;
const PAD_TOP = 50;
const PAD_BOTTOM = 30;
const WIDTH = 780;
const COLOR_CORAL = "#FF5D72";
const COLOR_GREEN = "#46E8A4";
const COLOR_AXIS = "#506663";
const COLOR_INK = "#eaf6f4";
const COLOR_INK3 = "#7d9591";

export function TornadoChart({ rows, base }: Props) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const height = PAD_TOP + rows.length * ROW_HEIGHT + PAD_BOTTOM;
  const bounds = tornadoBounds(rows, base);
  const range = bounds.max - bounds.min;
  const xOf = (v: number) => PAD_LEFT + ((v - bounds.min) / range) * innerW;
  const xBase = xOf(base);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Tornado — sensibilidade do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <svg width={WIDTH} height={height} role="img" aria-label="Tornado de sensibilidade">
          {/* X axis ticks (top) */}
          <text x={PAD_LEFT} y={PAD_TOP - 18} fill={COLOR_INK3} fontSize="10" textAnchor="start">
            {formatRsK(bounds.min)}
          </text>
          <text x={xBase} y={PAD_TOP - 18} fill={COLOR_INK} fontSize="10" textAnchor="middle" fontWeight="700">
            Base {formatRs(base)}
          </text>
          <text x={PAD_LEFT + innerW} y={PAD_TOP - 18} fill={COLOR_INK3} fontSize="10" textAnchor="end">
            {formatRsK(bounds.max)}
          </text>

          {/* Vertical base line */}
          <line
            x1={xBase}
            x2={xBase}
            y1={PAD_TOP - 6}
            y2={PAD_TOP + rows.length * ROW_HEIGHT}
            stroke={COLOR_AXIS}
            strokeDasharray="2 2"
          />

          {/* Rows */}
          {rows.map((row, i) => {
            const yCenter = PAD_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const barH = 22;
            const yBar = yCenter - barH / 2;

            // Each impact rendered separately: signed offset from base.
            // Color: coral if impact < 0 (worse than base), green if > 0 (better).
            const segments = [
              { impact: row.pessImpact, key: "pess" },
              { impact: row.optImpact,  key: "opt"  },
            ];

            return (
              <g key={row.parameter}>
                {/* Label esquerda */}
                <text
                  x={PAD_LEFT - 10}
                  y={yCenter + 4}
                  fill={COLOR_INK}
                  fontSize="11"
                  textAnchor="end"
                >
                  {row.label}
                </text>

                {/* Barras */}
                {segments.map(({ impact, key }) => {
                  if (impact === 0) return null;
                  const xEnd = xOf(base + impact);
                  const x = Math.min(xBase, xEnd);
                  const w = Math.abs(xEnd - xBase);
                  const fill = impact < 0 ? COLOR_CORAL : COLOR_GREEN;
                  return (
                    <rect
                      key={key}
                      x={x}
                      y={yBar}
                      width={w}
                      height={barH}
                      fill={fill}
                      fillOpacity={0.85}
                    />
                  );
                })}

                {/* Amplitude label direita */}
                <text
                  x={PAD_LEFT + innerW + 10}
                  y={yCenter + 4}
                  fill={COLOR_INK3}
                  fontSize="11"
                  textAnchor="start"
                  className="tabular"
                >
                  {formatRsK(row.amplitude)}
                </text>
              </g>
            );
          })}
        </svg>
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
git add web/components/sensibilidade/TornadoChart.tsx
git commit -m "feat(sensibilidade): add TornadoChart SVG with signed-impact coloring"
```

---

## Task 5: `SensibilidadeTable.tsx`

**Files:**
- Create: `web/components/sensibilidade/SensibilidadeTable.tsx`

- [ ] **Step 1: Create component**

Create `web/components/sensibilidade/SensibilidadeTable.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SensitivityRow } from "@/lib/sensibilidade-derive";
import { formatRs, formatRsK } from "@/lib/format";

type Props = { rows: SensitivityRow[] };

export function SensibilidadeTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento</h3>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Parâmetro</th>
              <th className="text-right font-normal py-2 px-2">Pessimista</th>
              <th className="text-right font-normal py-2 px-2">Base</th>
              <th className="text-right font-normal py-2 px-2">Otimista</th>
              <th className="text-right font-normal py-2 pl-2">Amplitude</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pessClass = row.pessimistic < row.base ? "text-accent-coral" : "text-accent-green";
              const optClass  = row.optimistic  < row.base ? "text-accent-coral" : "text-accent-green";
              return (
                <tr key={row.parameter} className="border-b border-line-soft last:border-b-0">
                  <td className="py-2 pr-2 text-ink">{row.label}</td>
                  <td className={`text-right py-2 px-2 tabular ${pessClass}`}>{formatRs(row.pessimistic)}</td>
                  <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.base)}</td>
                  <td className={`text-right py-2 px-2 tabular ${optClass}`}>{formatRs(row.optimistic)}</td>
                  <td className="text-right py-2 pl-2 tabular text-ink-2">{formatRsK(row.amplitude)}</td>
                </tr>
              );
            })}
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
git add web/components/sensibilidade/SensibilidadeTable.tsx
git commit -m "feat(sensibilidade): add SensibilidadeTable with sign-colored cells"
```

---

## Task 6: `SensibilidadePageContent.tsx` + wire route + smoke (TDD)

**Files:**
- Create: `web/components/sensibilidade/SensibilidadePageContent.tsx`
- Create: `web/tests/sensibilidade-page.test.tsx`
- Modify: `web/app/sensibilidade/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/sensibilidade-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SensibilidadePageContent } from "@/components/sensibilidade/SensibilidadePageContent";
import type { SimulateOut } from "@/lib/api-types";

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { horizon: number } }) => T) =>
    selector({ scenario: { horizon: 10 } }),
}));

const fakeSimOut: SimulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: [230_000, 250_000, 270_000, 290_000, 310_000, 330_000, 350_000, 365_000, 378_000, 386_000, 393_000],
    annualIncome: Array(11).fill(10_000) as number[],
    cumulativeIncome: Array(11).fill(0) as number[],
    debtBalance: null,
    internalPortfolio: null,
  } as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [
    { parameter: "monthly_rent",            pessimistic: 320_000, optimistic: 470_000 },
    { parameter: "annual_appreciation",     pessimistic: 340_000, optimistic: 450_000 },
    { parameter: "vacancy_months_per_year", pessimistic: 410_000, optimistic: 380_000 },
    { parameter: "management_fee_pct",      pessimistic: 400_000, optimistic: 385_000 },
    { parameter: "iptu_rate",               pessimistic: 395_000, optimistic: 390_000 },
    { parameter: "income_tax_bracket",      pessimistic: 393_000, optimistic: 392_500 },
  ],
  taxComparison: [] as never,
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

describe("SensibilidadePageContent", () => {
  beforeEach(() => {
    mockSimReturn = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza KPI banner com base patrimony", () => {
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getByText(/patrimônio imóvel/i)).toBeInTheDocument();
    // R$ 393.000 com formatação pt-BR
    expect(screen.getAllByText(/393\.000/).length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza tornado svg com 6 linhas (uma por parâmetro)", () => {
    const { container } = render(wrap(<SensibilidadePageContent />));
    const svg = container.querySelector("svg[aria-label='Tornado de sensibilidade']");
    expect(svg).toBeTruthy();
    // Cada linha vira um <g> dentro do svg
    expect(svg!.querySelectorAll("g").length).toBe(6);
  });

  it("renderiza tabela com labels traduzidos", () => {
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getAllByText(/Aluguel mensal/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IPTU/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Faixa IR/).length).toBeGreaterThanOrEqual(1);
  });

  it("loading → renderiza skeleton", () => {
    mockSimReturn = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<SensibilidadePageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSimReturn = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<SensibilidadePageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/sensibilidade-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create SensibilidadePageContent**

Create `web/components/sensibilidade/SensibilidadePageContent.tsx`:

```tsx
"use client";

import { useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { enrichRows, sortByImpact } from "@/lib/sensibilidade-derive";
import { KpiBaseCard } from "./KpiBaseCard";
import { TornadoChart } from "./TornadoChart";
import { SensibilidadeTable } from "./SensibilidadeTable";

export function SensibilidadePageContent() {
  const horizon = useScenarioStore((s) => s.scenario.horizon);
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <KpiSkeleton />
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const base = data.realEstate.patrimony[data.realEstate.patrimony.length - 1];
  const rows = sortByImpact(enrichRows(data.sensitivity, base));

  return (
    <div className="space-y-6">
      <KpiBaseCard base={base} horizonYears={horizon} />
      <TornadoChart rows={rows} base={base} />
      <SensibilidadeTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 4: Wire route**

Replace entire content of `web/app/sensibilidade/page.tsx`:

```tsx
import { SensibilidadePageContent } from "@/components/sensibilidade/SensibilidadePageContent";

export default function SensibilidadePage() {
  return <SensibilidadePageContent />;
}
```

- [ ] **Step 5: Run smoke + typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -3
npx vitest run tests/sensibilidade-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; 5 smoke tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 127 (baseline) + 8 (derive) + 5 (page) = 140 tests passing.

- [ ] **Step 7: Run Next build (catches ESLint)**

```bash
cd /home/lucgomes/workspace/investa/web && pnpm run build 2>&1 | tail -15
```
Expected: build OK. `/sensibilidade` route ≥ a few KB (não mais 850 B placeholder).

- [ ] **Step 8: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/app/sensibilidade/page.tsx \
        web/components/sensibilidade/SensibilidadePageContent.tsx \
        web/tests/sensibilidade-page.test.tsx
git commit -m "feat(sensibilidade): wire SensibilidadePageContent + smoke tests"
```

---

## Task 7: README + push + smoke prod + merge

**Files:** `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find `- ⬜ Sensibilidade` e substitua por:
```
  - ✅ Sensibilidade (KPI base, tornado SVG, tabela detalhada)
```

- [ ] **Step 2: Commit + push**

```bash
cd /home/lucgomes/workspace/investa
git add README.md
git commit -m "docs: mark aba Sensibilidade complete"
git push -u origin feat/fase4-sensibilidade
```

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge feat/fase4-sensibilidade
git push origin main
```

- [ ] **Step 4: Smoke prod (após Vercel rebuild ~2 min)**

Open `https://investa-beta.vercel.app/sensibilidade`. Verify:

1. **KPI banner**: "Patrimônio Imóvel ao fim de 10 anos" → R$ ~393k (verde featured)
2. **Tornado**: 6 linhas ordenadas por amplitude desc; Aluguel mensal no topo; barras coral (impacto < base) e green (impacto > base)
3. **Linha vertical central** com label "Base R$ ~393k"
4. **Tabela**: 6 linhas com Pessimista (coral/green dependendo do sinal) / Base / Otimista / Amplitude
5. **Drawer**: alterar aluguel mensal de 1500 → 2000 e aplicar → tornado e tabela recalculam
6. Sem erros no console

- [ ] **Step 5: Cleanup branches**

```bash
git branch -d feat/fase4-sensibilidade feat/fase4-sensibilidade-spec
git push origin --delete feat/fase4-sensibilidade
```
(Spec branch nunca foi pushada — ignore o erro do remote-delete.)

---

## Done criteria

- 7 tasks concluídas
- ~13 testes novos (8 derive + 5 page); suite total ≥ 140
- Aba `/sensibilidade` em produção com KPI base + tornado + tabela
- README atualizado, branches deletadas
- Próxima aba: **Tributação** (Fase 4 / aba 5 de 7)
