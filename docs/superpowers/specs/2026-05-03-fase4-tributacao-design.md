# Aba Tributação — Design (Fase 4)

**Data:** 2026-05-03
**Status:** Aprovado pelo usuário (decisões B/B/B/A registradas em conversa)
**Fase do projeto:** Fase 4 / aba 5 de 7 (após Renda Fixa, Imóvel, Carteira, Sensibilidade)

---

## Objetivo

Substituir o placeholder de `app/tributacao/page.tsx` por uma aba de análise read-only que compara a carga tributária anual entre Imóvel e Carteira Diversificada. Consome `simulate.data.taxComparison` (já disponível em `/api/simulate`) sem novo endpoint.

## Decisões de design

1. **Papel da aba**: read-only (consistente com Imóvel/Carteira/Sensibilidade). Sem inputs próprios.
2. **Blocos**: 4 — KPI row + chart comparativo + tabela + notas tributárias (decisão B da pergunta 1).
3. **KPIs**: 3 absolutos + 1 card "Diferença" feature destacando o gap (decisão B da pergunta 2).
4. **Chart**: barras stacked horizontais (Líquido + Imposto somando = Receita Bruta) (decisão B da pergunta 3).
5. **Notas tributárias**: hardcoded 5 bullets em `lib/tributacao-derive.ts` (decisão A da pergunta 4).
6. **Source**: `useSimulate()` (cache compartilhado com Visão Geral / Sensibilidade). Sem novo endpoint.

## Arquitetura

### Estrutura de arquivos

```
web/app/tributacao/page.tsx                                # rota (server)
web/components/tributacao/
  TributacaoPageContent.tsx                                # client wrapper
  KpiRowTributacao.tsx                                     # bloco 1 — 4 KPIs
  TaxComparisonChart.tsx                                   # bloco 2 — barras stacked
  TributacaoTable.tsx                                      # bloco 3 — tabela
  TaxNotesCard.tsx                                         # bloco 4 — notas 2026
web/lib/tributacao-derive.ts                               # splitTaxRows + taxDelta + TAX_NOTES
```

Sem store próprio. `useSimulate()` (do `lib/api.ts`) já gerencia cache.

### Data flow

```
TributacaoPageContent
├── useSimulate() → { data, isLoading, error, refetch }   (TanStack — cache compartilhado)
└── lib/tributacao-derive.ts (puro)
    ├── splitTaxRows(rows) → { realEstate, portfolio }
    ├── taxDelta(re, pf) → { taxDiffAbs, burdenDiffPp, realEstatePaysMore }
    ├── SCENARIO_COLORS (paleta fixa)
    └── TAX_NOTES (5 bullets hardcoded)
```

### Layout (`TributacaoPageContent.tsx`)

```
┌──────────────────────────────────────────────┐
│  KpiRowTributacao (4 cards)                  │
├──────────────────────────────────────────────┤
│  TaxComparisonChart (full width)             │
├──────────────────────────────────────────────┤
│  TributacaoTable (full width)                │
├──────────────────────────────────────────────┤
│  TaxNotesCard (full width)                   │
└──────────────────────────────────────────────┘
```

Estados:
- `<KpiSkeleton />` × 4 enquanto `useSimulate` carrega
- `<ErrorCard onRetry={refetch} />` em erro de rede
- `<ErrorCard message="Dados de tributação incompletos" />` se `splitTaxRows` retornar nulls (defensivo)

## `lib/tributacao-derive.ts` — API

```ts
import type { TaxComparisonRowOut } from "./api-types";

// O cenário Imóvel pode aparecer como "Imóvel" ou "Imóvel (financiado)"
// dependendo de scenario.realEstate.financing. Detectamos pelo prefix.
function isRealEstate(scenario: string): boolean;
function isPortfolio(scenario: string): boolean;
//   isPortfolio: scenario === "Carteira Diversificada"

export function splitTaxRows(rows: TaxComparisonRowOut[]): {
  realEstate: TaxComparisonRowOut | null;
  portfolio:  TaxComparisonRowOut | null;
};

export type TaxDelta = {
  taxDiffAbs:         number;       // realEstate.annualTax - portfolio.annualTax
  burdenDiffPp:       number;       // realEstate.effectiveTaxBurden - portfolio.effectiveTaxBurden
  realEstatePaysMore: boolean;      // taxDiffAbs > 0
};

export function taxDelta(
  re: TaxComparisonRowOut,
  pf: TaxComparisonRowOut,
): TaxDelta;

export const SCENARIO_COLORS = {
  realEstate: "#FF6B5B",   // coral
  portfolio:  "#46E8A4",   // green
  tax:        "#FF5D72",   // vermelho mais escuro
} as const;

export const TAX_NOTES: Array<{ title: string; body: string }>;
// 5 entradas:
//  - FIIs                — rendimentos isentos PF (ganho de capital 20% à parte)
//  - Ações BR dividendos — isentos até R$ 50k/mês ou R$ 600k/ano por empresa
//  - Ações US dividendos — 30% retidos na fonte; tratado pode reduzir
//  - Aluguel (PF)        — tabela progressiva carnê-leão (0–27,5%)
//  - Tesouro Direto      — tabela regressiva 22,5% → 15% (180–720d)
```

## Componentes — interfaces

```tsx
// KpiRowTributacao.tsx
type Props = {
  realEstate: TaxComparisonRowOut;
  portfolio:  TaxComparisonRowOut;
};
// 4 KpiCards:
//  0 — "Imposto Imóvel"        → formatRs(realEstate.annualTax)
//  1 — "Imposto Carteira"      → formatRs(portfolio.annualTax)
//  2 — "Carga efetiva Imóvel"  → formatPercent(realEstate.effectiveTaxBurden, 2)
//                                 sub: formatPercent(portfolio.effectiveTaxBurden, 2) + " carteira"
//  3 — "Diferença" (feature)   → formatRs(|delta.taxDiffAbs|)
//      sub: realEstatePaysMore
//        ? "Imóvel paga +" + formatPercent(burdenDiffPp, 2) + " a mais"
//        : "Carteira paga +" + formatPercent(-burdenDiffPp, 2) + " a mais"
//      valueColor: realEstatePaysMore ? "red" : "green"

// TaxComparisonChart.tsx
type Props = { realEstate: TaxComparisonRowOut; portfolio: TaxComparisonRowOut };
// SVG inline ~720×170px; 2 barras horizontais stacked, uma por cenário.
// Largura proporcional à grossIncome (max das duas = 100% da largura útil).
// Cada barra:
//   - segmento "Líquido" (largura = netIncome / max grossIncome) na cor do cenário
//   - segmento "Imposto" (largura = annualTax / max grossIncome) em SCENARIO_COLORS.tax
//   - juntos somam grossIncome / max grossIncome
// Labels:
//   - À esquerda: nome do cenário ("Imóvel" / "Carteira")
//   - Sobre o segmento Líquido: formatRs(netIncome)
//   - Sobre o segmento Imposto: formatRs(annualTax) + " (X,XX%)"
// Pad horizontal pra rótulos: 130px à esquerda + 30px à direita.

// TributacaoTable.tsx
type Props = { rows: TaxComparisonRowOut[] };
// 5 colunas: Cenário · Receita Bruta · Imposto Anual · Receita Líquida · Carga Efetiva
// Coluna Cenário com bullet colorido (coral pra Imóvel, green pra Carteira).
// Pattern visual: SensibilidadeTable.

// TaxNotesCard.tsx
type Props = {};
// Header "Notas tributárias 2026" + lista de 5 bullets de TAX_NOTES.
// Pattern visual: RisksCard da aba Imóvel (title destacado + body).
```

### `TributacaoPageContent.tsx`

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

  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

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

## Testes

2 arquivos novos:

### `web/tests/tributacao-derive.test.ts` (~7 testes — pura)
- `splitTaxRows` localiza "Imóvel" + "Carteira Diversificada"
- `splitTaxRows` localiza "Imóvel (financiado)" pelo prefix
- `splitTaxRows` retorna nulls quando ausente
- `taxDelta`: IR Imóvel > Carteira → `realEstatePaysMore: true`
- `taxDelta`: IR Imóvel < Carteira → `realEstatePaysMore: false`
- `taxDelta`: `burdenDiffPp` consistente com a subtração
- `TAX_NOTES` tem 5 entradas com title + body não-vazios

### `web/tests/tributacao-page.test.tsx` (~5 smoke)

Mock `useSimulate` retornando fixture com `taxComparison` de 2 rows.

- Defaults → KPI "Imposto Imóvel" e "Imposto Carteira" presentes
- Renderiza chart `<svg>` com pelo menos 2 grupos (1 barra por cenário)
- Renderiza tabela com 2 linhas — textos "Imóvel" e "Carteira Diversificada"
- Renderiza TaxNotesCard com textos "FIIs" e "Aluguel" das notas
- `sim.isLoading: true` → renderiza `<KpiSkeleton />` (`.animate-pulse`)
- `sim.error` setado → renderiza `<ErrorCard />` (texto "falha")

Total: ~12 testes em 2 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Tributação → 4 KPIs: "Imposto Imóvel", "Imposto Carteira", "Carga efetiva Imóvel", "Diferença"
2. Card "Diferença" mostra valor absoluto formatado + sub explicativo
3. Chart 2 barras stacked com segmentos Líquido (cor do cenário) + Imposto (vermelho)
4. Tabela 2 linhas com bullet colorido coerente
5. Card "Notas tributárias 2026" com 5 bullets
6. Mexer no Drawer (aluguel, peso de FIIs, IR) → recálculo ao aplicar
7. Sem erros no console

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- Atualização das notas conforme reforma tributária 2027+ (hoje hardcoded; no futuro pode virar feature flag por ano fiscal)
- Quebra do imposto da Carteira por classe (FIIs, Ações BR, Dividend US, Tesouro) com mini-bars
- Comparação multi-anos (não só renda anual atual, mas trajetória de tributação ao longo do horizonte)
- Calculadora de carnê-leão pessoal (input renda mensal → IR efetivo)
- Botão "exportar tributação como CSV/PDF"
