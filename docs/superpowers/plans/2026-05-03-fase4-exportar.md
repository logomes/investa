# Aba Exportar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/exportar/page.tsx` por uma aba que mostra preview do comparativo (Imóvel × Carteira × Tesouro) ao longo do horizonte e permite download em CSV BR-friendly (Excel-ready).

**Architecture:** A aba consome `useSimulate()` (cache compartilhado). `lib/exportar-csv.ts` (puro) deriva long-format rows e gera CSV BR-friendly com BOM utf-8-sig. Download via Blob + URL.createObjectURL no click do botão. 1 card visível.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui, TanStack Query v5, vitest, @testing-library/react.

**Branch base:** `feat/fase4-exportar-spec` (já existe). Implementação em `feat/fase4-exportar`.

**Spec:** `docs/superpowers/specs/2026-05-03-fase4-exportar-design.md`.

---

## File Structure

**Cria:**
```
web/lib/exportar-csv.ts                                       # buildLongFormatRows + toCsvBR + csvFilename
web/components/exportar/ExportarPageContent.tsx               # client wrapper (orchestrator)
web/components/exportar/ExportPreviewCard.tsx                 # bloco 1 — header + botão + tabela
web/tests/exportar-csv.test.ts                                # ~10 testes
web/tests/exportar-page.test.tsx                              # ~5 smoke
```

**Modifica:**
```
web/app/exportar/page.tsx                                     # placeholder → wire ExportarPageContent
README.md                                                     # marca aba Exportar ✅
```

**Não toca:**
- `api/` — `/api/simulate` já entrega tudo
- Drawer — Exportar não tem inputs próprios
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
Expected: branch `feat/fase4-exportar-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-exportar
```

- [ ] **Step 3: Confirm baseline**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run 2>&1 | tail -5
```
Expected: 30 test files, 182 tests passing.

---

## Task 2: `lib/exportar-csv.ts` — 3 helpers (TDD)

**Files:**
- Create: `web/tests/exportar-csv.test.ts`
- Create: `web/lib/exportar-csv.ts`

- [ ] **Step 1: Write failing test file**

Create `web/tests/exportar-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildLongFormatRows,
  toCsvBR,
  csvFilename,
  type LongRow,
} from "@/lib/exportar-csv";
import type { SimulateOut } from "@/lib/api-types";

const SIM: SimulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2],
    patrimony: [230_000, 260_000, 290_000],
    annualIncome: [0, 9_000, 9_500],
    cumulativeIncome: [0, 9_000, 18_500],
    debtBalance: null,
    internalPortfolio: null,
  },
  portfolio: {
    label: "Carteira diversificada",
    color: "#27AE60",
    years: [0, 1, 2],
    patrimony: [230_000, 250_000, 275_000],
    annualIncome: [0, 14_794, 15_500],
    cumulativeIncome: [0, 14_794, 30_294],
    debtBalance: null,
    internalPortfolio: null,
  },
  benchmark: {
    label: "Tesouro Selic líquido",
    color: "#5CC8FF",
    years: [0, 1, 2],
    patrimony: [230_000, 258_000, 289_000],
    annualIncome: [0, 28_000, 31_000],
    cumulativeIncome: [0, 28_000, 59_000],
    debtBalance: null,
    internalPortfolio: null,
  },
  sensitivity: [],
  taxComparison: [],
};

describe("exportar-csv — buildLongFormatRows", () => {
  it("retorna 3 × years.length linhas", () => {
    const rows = buildLongFormatRows(SIM);
    expect(rows).toHaveLength(9);  // 3 cenários × 3 anos
  });

  it("ordem fixa: realEstate → portfolio → benchmark", () => {
    const rows = buildLongFormatRows(SIM);
    expect(rows[0].scenario).toBe("Imóvel");
    expect(rows[2].scenario).toBe("Imóvel");
    expect(rows[3].scenario).toBe("Carteira diversificada");
    expect(rows[5].scenario).toBe("Carteira diversificada");
    expect(rows[6].scenario).toBe("Tesouro Selic líquido");
    expect(rows[8].scenario).toBe("Tesouro Selic líquido");
  });

  it("cada row tem ano + 4 colunas numéricas", () => {
    const rows = buildLongFormatRows(SIM);
    const first = rows[0];
    expect(first.year).toBe(0);
    expect(first.patrimony).toBe(230_000);
    expect(first.annualIncome).toBe(0);
    expect(first.cumulativeIncome).toBe(0);
  });

  it("preserva a ordem dos anos dentro de cada cenário", () => {
    const rows = buildLongFormatRows(SIM);
    expect(rows[0].year).toBe(0);
    expect(rows[1].year).toBe(1);
    expect(rows[2].year).toBe(2);
  });
});

describe("exportar-csv — toCsvBR", () => {
  it("começa com BOM utf-8-sig (\\uFEFF)", () => {
    const csv = toCsvBR([]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it("primeira linha após BOM é o header pt-BR", () => {
    const csv = toCsvBR([]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada");
  });

  it("usa ';' como separador (5 colunas → 4 separadores por linha)", () => {
    const row: LongRow = {
      scenario: "Imóvel",
      year: 0,
      patrimony: 230_000,
      annualIncome: 0,
      cumulativeIncome: 0,
    };
    const csv = toCsvBR([row]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1].split(";")).toHaveLength(5);
  });

  it("decimais com vírgula: 123.45 → '123,45'", () => {
    const row: LongRow = {
      scenario: "X",
      year: 0,
      patrimony: 123.45,
      annualIncome: 9.5,
      cumulativeIncome: 0.001,
    };
    const csv = toCsvBR([row]);
    const lines = csv.slice(1).split("\r\n");
    const cells = lines[1].split(";");
    expect(cells[2]).toBe("123,45");
    expect(cells[3]).toBe("9,5");
    expect(cells[4]).toBe("0,001");
  });

  it("linhas separadas por \\r\\n", () => {
    const row: LongRow = {
      scenario: "X",
      year: 0,
      patrimony: 1,
      annualIncome: 2,
      cumulativeIncome: 3,
    };
    const csv = toCsvBR([row, row]);
    expect(csv.includes("\r\n")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("array vazio retorna BOM + header + \\r\\n", () => {
    const csv = toCsvBR([]);
    expect(csv).toBe("﻿Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada\r\n");
  });
});

describe("exportar-csv — csvFilename", () => {
  it("formato 'simulacao_imovel_vs_carteira_{N}anos.csv'", () => {
    expect(csvFilename(10)).toBe("simulacao_imovel_vs_carteira_10anos.csv");
    expect(csvFilename(1)).toBe("simulacao_imovel_vs_carteira_1anos.csv");
    expect(csvFilename(30)).toBe("simulacao_imovel_vs_carteira_30anos.csv");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/exportar-csv.test.ts 2>&1 | tail -10
```
Expected: tests fail (module not found).

- [ ] **Step 3: Create implementation**

Create `web/lib/exportar-csv.ts`:

```ts
import type { SimulateOut, SimulationResultOut } from "./api-types";

export type LongRow = {
  scenario: string;
  year: number;
  patrimony: number;
  annualIncome: number;
  cumulativeIncome: number;
};

export function buildLongFormatRows(sim: SimulateOut): LongRow[] {
  const result: LongRow[] = [];
  const append = (r: SimulationResultOut) => {
    for (let i = 0; i < r.years.length; i++) {
      result.push({
        scenario: r.label,
        year: r.years[i],
        patrimony: r.patrimony[i],
        annualIncome: r.annualIncome[i],
        cumulativeIncome: r.cumulativeIncome[i],
      });
    }
  };
  append(sim.realEstate);
  append(sim.portfolio);
  append(sim.benchmark);
  return result;
}

// `,` as decimal separator. `.toString()` preserves precision (no fixed
// rounding); `replace` swaps the dot. Integers ("1000") pass through unchanged.
function formatBR(value: number): string {
  return value.toString().replace(".", ",");
}

export function toCsvBR(rows: LongRow[]): string {
  const BOM = "﻿";
  const header = "Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada";
  const body = rows.map((r) =>
    [
      r.scenario,
      r.year.toString(),
      formatBR(r.patrimony),
      formatBR(r.annualIncome),
      formatBR(r.cumulativeIncome),
    ].join(";"),
  );
  return BOM + [header, ...body].join("\r\n") + "\r\n";
}

export function csvFilename(horizonYears: number): string {
  return `simulacao_imovel_vs_carteira_${horizonYears}anos.csv`;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/exportar-csv.test.ts 2>&1 | tail -10
```
Expected: ~13 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/exportar-csv.ts web/tests/exportar-csv.test.ts
git commit -m "feat(exportar): add exportar-csv lib (long format + CSV BR + filename)"
```

---

## Task 3: `ExportPreviewCard.tsx`

**Files:**
- Create: `web/components/exportar/ExportPreviewCard.tsx`

- [ ] **Step 1: Create directory + component**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/exportar
```

Create `web/components/exportar/ExportPreviewCard.tsx`:

```tsx
"use client";

import { Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toCsvBR, csvFilename, type LongRow } from "@/lib/exportar-csv";
import { formatRs } from "@/lib/format";

type Props = {
  rows: LongRow[];
  horizonYears: number;
};

const SCENARIO_COLORS: Record<string, string> = {
  "Imóvel": "#FF6B5B",
  "Imóvel (financiado)": "#FF6B5B",
  "Carteira diversificada": "#46E8A4",
  "Tesouro Selic líquido": "#5CC8FF",
};

function bulletColor(scenario: string): string {
  return SCENARIO_COLORS[scenario] ?? "#7d9591";
}

function downloadCsv(rows: LongRow[], horizonYears: number) {
  const csv = toCsvBR(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename(horizonYears);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportPreviewCard({ rows, horizonYears }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink">
              Comparativo Imóvel × Carteira × Tesouro
            </h3>
            <p className="text-[11px] text-ink-3 mt-1">
              Long format · 3 cenários × {horizonYears + 1} anos = {rows.length} linhas
            </p>
          </div>
          <Button onClick={() => downloadCsv(rows, horizonYears)}>
            <Download className="w-4 h-4 mr-1.5" />
            Baixar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[440px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2">Cenário</th>
                <th className="text-right font-normal py-2 px-2">Ano</th>
                <th className="text-right font-normal py-2 px-2">Patrimônio</th>
                <th className="text-right font-normal py-2 px-2">Renda Anual</th>
                <th className="text-right font-normal py-2 pl-2">Renda Acumulada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-line-soft last:border-b-0">
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
                  <td className="text-right py-2 px-2 tabular text-ink-2">{row.year}</td>
                  <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.patrimony)}</td>
                  <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs(row.annualIncome)}</td>
                  <td className="text-right py-2 pl-2 tabular text-ink-2">{formatRs(row.cumulativeIncome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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
git add web/components/exportar/ExportPreviewCard.tsx
git commit -m "feat(exportar): add ExportPreviewCard with table preview + download button"
```

---

## Task 4: `ExportarPageContent.tsx` + wire route + smoke (TDD)

**Files:**
- Create: `web/components/exportar/ExportarPageContent.tsx`
- Create: `web/tests/exportar-page.test.tsx`
- Modify: `web/app/exportar/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/exportar-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExportarPageContent } from "@/components/exportar/ExportarPageContent";
import type { SimulateOut } from "@/lib/api-types";

const fakeSimOut: SimulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 30_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 1_000),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 500),
    debtBalance: null,
    internalPortfolio: null,
  },
  portfolio: {
    label: "Carteira diversificada",
    color: "#27AE60",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 25_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 1_500),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 750),
    debtBalance: null,
    internalPortfolio: null,
  },
  benchmark: {
    label: "Tesouro Selic líquido",
    color: "#5CC8FF",
    years: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    patrimony: Array.from({ length: 11 }, (_, i) => 230_000 + i * 28_000),
    annualIncome: Array.from({ length: 11 }, (_, i) => i * 2_800),
    cumulativeIncome: Array.from({ length: 11 }, (_, i) => i * i * 1_400),
    debtBalance: null,
    internalPortfolio: null,
  },
  sensitivity: [],
  taxComparison: [],
};

let mockSim: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { horizon: number } }) => T) =>
    selector({ scenario: { horizon: 10 } }),
}));

vi.mock("@/lib/api", () => ({
  useSimulate: () => mockSim,
  useMonteCarlo: () => ({ data: undefined, isLoading: false, error: null }),
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("ExportarPageContent", () => {
  beforeEach(() => {
    mockSim = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
  });

  it("renderiza header + botão Baixar CSV", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/Comparativo Imóvel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar csv/i })).toBeInTheDocument();
  });

  it("renderiza tabela com 33 linhas (3 cenários × 11 anos)", () => {
    const { container } = render(wrap(<ExportarPageContent />));
    const tbody = container.querySelector("tbody");
    expect(tbody).toBeTruthy();
    expect(tbody!.querySelectorAll("tr")).toHaveLength(33);
  });

  it("caption mostra 'X linhas' com contagem correta", () => {
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/33 linhas/i)).toBeInTheDocument();
  });

  it("loading → renderiza skeleton", () => {
    mockSim = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<ExportarPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("erro → renderiza ErrorCard", () => {
    mockSim = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<ExportarPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/exportar-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create ExportarPageContent**

Create `web/components/exportar/ExportarPageContent.tsx`:

```tsx
"use client";

import { useScenarioStore } from "@/lib/store";
import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { buildLongFormatRows } from "@/lib/exportar-csv";
import { ExportPreviewCard } from "./ExportPreviewCard";

export function ExportarPageContent() {
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

  const rows = buildLongFormatRows(sim.data!);

  return (
    <div className="space-y-6">
      <ExportPreviewCard rows={rows} horizonYears={horizon} />
    </div>
  );
}
```

- [ ] **Step 4: Wire route**

Replace entire content of `web/app/exportar/page.tsx`:

```tsx
import { ExportarPageContent } from "@/components/exportar/ExportarPageContent";

export default function ExportarPage() {
  return <ExportarPageContent />;
}
```

- [ ] **Step 5: Run smoke + typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -3
npx vitest run tests/exportar-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; 5 smoke tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 182 + 13 + 5 = 200 tests passing.

- [ ] **Step 7: Run Next build (catches ESLint stricter than tsc)**

```bash
cd /home/lucgomes/workspace/investa/web && pnpm run build 2>&1 | tail -15
```
Expected: build succeeds; `/exportar` route ≥ a few KB.

- [ ] **Step 8: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/app/exportar/page.tsx \
        web/components/exportar/ExportarPageContent.tsx \
        web/tests/exportar-page.test.tsx
git commit -m "feat(exportar): wire ExportarPageContent + smoke tests"
```

---

## Task 5: README + push + smoke prod + merge

**Files:** `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find `- ⬜ Exportar` e substitua por:
```
  - ✅ Exportar (preview da tabela + download CSV BR-friendly)
```

E logo acima da lista de abas, mudar o título da Fase 4 de `⏳ Fase 4` para `✅ Fase 4 — Abas individuais (todas as 7)`.

- [ ] **Step 2: Commit + push**

```bash
cd /home/lucgomes/workspace/investa
git add README.md
git commit -m "docs: mark aba Exportar complete + Fase 4 done (7/7)"
git push -u origin feat/fase4-exportar
```

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge feat/fase4-exportar
git push origin main
```

- [ ] **Step 4: Smoke prod (após Vercel rebuild ~2 min)**

Open `https://investa-beta.vercel.app/exportar`. Verify:

1. **Header**: "Comparativo Imóvel × Carteira × Tesouro" + caption "Long format · 3 cenários × 11 anos = 33 linhas"
2. **Botão "Baixar CSV"** com ícone de download à direita
3. **Tabela**: 33 linhas com scroll vertical
4. **Bullet colorido** por cenário: coral (Imóvel), green (Carteira), cyan (Tesouro)
5. **Click "Baixar CSV"** → download `simulacao_imovel_vs_carteira_10anos.csv`
6. **Abrir no Excel BR**: 5 colunas separadas, decimais com vírgula, sem caracteres mojibake (acentos OK)
7. **Drawer → mudar horizon (10 → 5)** → tabela com 18 linhas, filename muda pra `_5anos.csv`
8. Sem erros no console

- [ ] **Step 5: Cleanup branches**

```bash
git branch -d feat/fase4-exportar feat/fase4-exportar-spec
git push origin --delete feat/fase4-exportar
```

---

## Done criteria

- 5 tasks concluídas
- ~18 testes novos (13 csv + 5 page); suite total ≥ 200
- Aba `/exportar` em produção com preview + download CSV BR
- README atualizado, branches deletadas
- **Fase 4 — 7 de 7 abas concluídas** 🎉
