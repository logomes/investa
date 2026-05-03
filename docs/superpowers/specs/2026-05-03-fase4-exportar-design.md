# Aba Exportar — Design (Fase 4)

**Data:** 2026-05-03
**Status:** Aprovado pelo usuário (decisões A/A/A registradas em conversa)
**Fase do projeto:** Fase 4 / aba 7 de 7 (última)

---

## Objetivo

Substituir o placeholder de `app/exportar/page.tsx` por uma aba que mostra preview do comparativo (Imóvel × Carteira × Tesouro Selic) ao longo do horizonte e permite download em CSV BR-friendly (Excel-ready).

## Decisões de design

1. **Escopo**: paridade Streamlit — 1 botão de download CSV + preview da tabela. Demais datasets (sensibilidade, tributação, MC) ficam em FUTURE_IMPROVEMENTS (decisão A da pergunta 1).
2. **Preview**: tabela inline com todas as linhas (3 cenários × `horizon+1` anos = ~33 linhas para horizon=10), scroll vertical (decisão A da pergunta 2).
3. **Formato**: apenas CSV BR — separador `;`, decimal `,`, BOM utf-8-sig pra Excel BR detectar encoding (decisão A da pergunta 3).
4. **Source**: `useSimulate()` (cache compartilhado).

## Arquitetura

### Estrutura de arquivos

```
web/app/exportar/page.tsx                                # rota (server)
web/components/exportar/
  ExportarPageContent.tsx                                # client wrapper
  ExportPreviewCard.tsx                                  # tabela com preview + botão download
web/lib/exportar-csv.ts                                  # buildLongFormatRows + toCsvBR + csvFilename
```

Sem store próprio. `useSimulate()` (do `lib/api.ts`) já gerencia cache.

### Data flow

```
ExportarPageContent
├── useScenarioStore() → scenario.horizon                (filename)
├── useSimulate() → SimulateOut                          (cache compartilhado)
└── lib/exportar-csv.ts (puro)
    ├── buildLongFormatRows(sim) → LongRow[]
    ├── toCsvBR(rows) → string
    └── csvFilename(horizonYears) → string
```

### Layout

```
┌──────────────────────────────────────────────┐
│  ExportPreviewCard                           │
│   - header: título + caption + botão CSV     │
│   - tabela 5 colunas, ~33 linhas, scroll     │
└──────────────────────────────────────────────┘
```

Estados: `<KpiSkeleton />` enquanto carrega; `<ErrorCard onRetry={refetch} />` em erro.

## `lib/exportar-csv.ts` — API

```ts
import type { SimulateOut, SimulationResultOut } from "./api-types";

export type LongRow = {
  scenario: string;
  year: number;
  patrimony: number;
  annualIncome: number;
  cumulativeIncome: number;
};

// Concatena 3 cenários em formato longo (uma linha por ano-cenário).
// Ordem: realEstate → portfolio → benchmark
// (espelha build_comparison_dataframe([re, pf, bench]) do Streamlit).
export function buildLongFormatRows(sim: SimulateOut): LongRow[];

// CSV BR-friendly:
//  - BOM utf-8-sig (﻿) no início
//  - Header pt-BR: "Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada"
//  - Separador `;`, decimal `,`
//  - Linhas separadas por CRLF (\r\n)
//  - Trailing CRLF na última linha
export function toCsvBR(rows: LongRow[]): string;

// Filename paridade Streamlit: "simulacao_imovel_vs_carteira_{horizonYears}anos.csv".
// Sem regra de plural (consistente com Streamlit original).
export function csvFilename(horizonYears: number): string;
```

## Componentes — interfaces

```tsx
// ExportPreviewCard.tsx
type Props = {
  rows: LongRow[];
  horizonYears: number;
};
// Header (flex justify-between):
//   - Esquerda: título "Comparativo Imóvel × Carteira × Tesouro"
//              caption "Long format · 3 cenários × {horizonYears+1} anos = {rows.length} linhas"
//   - Direita: <Button> com ícone Download (lucide) + "Baixar CSV"
//
// Click handler:
//   const csv = toCsvBR(rows);
//   const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = csvFilename(horizonYears);
//   document.body.appendChild(a);
//   a.click();
//   a.remove();
//   URL.revokeObjectURL(url);
//
// Tabela (max-h-[440px] overflow-y-auto):
//   colunas: Cenário · Ano · Patrimônio · Renda Anual · Renda Acumulada
//   - Cenário com bullet colorido (coral=Imóvel, green=Carteira, cyan=Tesouro)
//   - Valores numéricos via formatRs
//   - Pattern visual: SensibilidadeTable
```

### `ExportarPageContent.tsx`

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
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const rows = buildLongFormatRows(sim.data!);

  return (
    <div className="space-y-6">
      <ExportPreviewCard rows={rows} horizonYears={horizon} />
    </div>
  );
}
```

## Testes

2 arquivos novos:

### `web/tests/exportar-csv.test.ts` (~10 testes — pura)

Fixture: `SimulateOut` mock com `years=[0,1,2]`.

- `buildLongFormatRows` retorna `years.length × 3` linhas
- Ordem fixa: primeiras N realEstate, depois portfolio, depois benchmark
- Cada row tem todas as 5 propriedades com valores numéricos corretos
- `toCsvBR` começa com BOM `﻿`
- Header pt-BR como primeira linha lógica: `"Cenário;Ano;Patrimônio;Renda Anual;Renda Acumulada"`
- Separador `;` (split de cada linha → length 5)
- Decimais com vírgula: `123.45` → `"123,45"`
- Linhas separadas por `\r\n`
- `toCsvBR([])` → BOM + header + `\r\n` (apenas cabeçalho)
- `csvFilename(10)` → `"simulacao_imovel_vs_carteira_10anos.csv"`

### `web/tests/exportar-page.test.tsx` (~5 smoke)

Mock `useSimulate` + `useScenarioStore`.

- Defaults → header "Comparativo Imóvel × Carteira × Tesouro" + botão "Baixar CSV" presentes
- Renderiza tabela com pelo menos 33 linhas (3 × 11 anos para horizon=10)
- Renderiza bullet colorido nas linhas (3 cores distintas no DOM)
- `sim.isLoading` → renderiza skeleton (`.animate-pulse`)
- `sim.error` → renderiza ErrorCard (texto "falha")

NÃO testar: o click do botão de download em si (envolve mock de Blob/URL.createObjectURL/document.createElement — alta complexidade, baixo valor; smoke manual em produção é suficiente).

Total: ~15 testes em 2 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Exportar → header "Comparativo..." + botão "Baixar CSV"
2. Tabela com ~33 linhas (3 cenários × 11 anos com horizon=10), scroll vertical
3. Bullet colorido por cenário (coral=Imóvel / green=Carteira / cyan=Tesouro)
4. Click "Baixar CSV" → download `simulacao_imovel_vs_carteira_10anos.csv`
5. Excel BR abre com 5 colunas separadas, decimais com vírgula, sem caracteres mojibake
6. Drawer → mudar horizon (10 → 5) → tabela com 18 linhas (3 × 6 anos), filename atualiza
7. Sem erros no console

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- **Outros datasets**: botões adicionais para sensibilidade, tributação, percentis MC, fixed-income
- **Formato JSON**: download bruto do `SimulateOut` para devs/reprocessamento
- **Copiar pra clipboard** (TSV, cola direto em Sheets/Excel)
- **CSV padrão internacional** (`,` separador, `.` decimal) — opção paralela ao BR
- **PDF report**: snapshot completo da análise (todos os charts) em uma página A4
