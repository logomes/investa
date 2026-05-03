# Aba Sensibilidade — Design (Fase 4)

**Data:** 2026-05-02
**Status:** Aprovado pelo usuário (decisões B/C registradas em conversa)
**Fase do projeto:** Fase 4 / aba 4 de 7 (após Renda Fixa, Imóvel, Carteira)

---

## Objetivo

Substituir o placeholder de `app/sensibilidade/page.tsx` por uma aba de análise read-only que mostra como o patrimônio do Imóvel ao fim do horizonte responde à variação de 6 parâmetros-chave. Consome `simulate.data.sensitivity` (já disponível em `/api/simulate`) sem novo endpoint.

## Decisões de design

1. **Papel da aba**: read-only (consistente com Imóvel/Carteira). Sem inputs próprios; toda configuração via Drawer.
2. **Blocos**: 3 — KPI base patrimony + tornado chart + tabela detalhada (decisão B da pergunta 1).
3. **Apresentação do base**: KPI card no topo + linha vertical no chart (decisão C da pergunta 2).
4. **Visualização**: SVG tornado inline (mesmo idioma de Imóvel waterfall e Carteira donut).
5. **Source**: `useSimulate()` (já compartilhado com Visão Geral; cache TanStack reutilizado). Sem novo endpoint.

## Arquitetura

### Estrutura de arquivos

```
web/app/sensibilidade/page.tsx                                # rota (server)
web/components/sensibilidade/
  SensibilidadePageContent.tsx                                # client wrapper
  KpiBaseCard.tsx                                             # bloco 1
  TornadoChart.tsx                                            # bloco 2
  SensibilidadeTable.tsx                                      # bloco 3
web/lib/sensibilidade-derive.ts                               # labels + enrich + sort + bounds
```

Sem store próprio. `useSimulate()` (do `lib/api.ts`) já gerencia cache.

### Data flow

```
SensibilidadePageContent
├── useSimulate() → { data, isLoading, error, refetch }    (TanStack — cache compartilhado com Visão Geral)
├── useScenarioStore() → scenario.horizon                  (apenas para o KPI banner)
└── lib/sensibilidade-derive.ts (puro)
    ├── enrichRows(sensitivity, base) → SensitivityRow[]
    ├── sortByImpact(rows) → ordem decrescente por amplitude
    ├── tornadoBounds(rows, base) → { min, max } simétrico
    └── paramLabel(parameter) → string traduzida
```

`base = data.realEstate.patrimony[N−1]` (último valor do array de patrimônio do Imóvel).

### Layout (`SensibilidadePageContent.tsx`)

```
┌──────────────────────────────────────────────┐
│  KpiBaseCard (full width, banner)            │
├──────────────────────────────────────────────┤
│  TornadoChart (full width)                   │
├──────────────────────────────────────────────┤
│  SensibilidadeTable (full width)             │
└──────────────────────────────────────────────┘
```

Estados: `<KpiSkeleton />` enquanto `useSimulate` carrega; `<ErrorCard />` em erro com retry.

## `lib/sensibilidade-derive.ts` — API

```ts
import type { SensitivityRowOut } from "./api-types";

// Mapeia parameter (snake_case do backend) para label exibido.
// Espelha _build_sensitivity_deltas em api/routers/simulation.py.
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
  parameter: string;          // raw, ex: "monthly_rent"
  label: string;              // ex: "Aluguel mensal (±20%)"
  pessimistic: number;
  optimistic: number;
  base: number;               // mesmo valor para todas as linhas
  pessImpact: number;         // pessimistic - base (negativo)
  optImpact: number;          // optimistic - base (positivo)
  amplitude: number;          // optimistic - pessimistic (sempre >= 0)
};

export function enrichRows(
  rows: SensitivityRowOut[],
  base: number,
): SensitivityRow[];

export function sortByImpact(rows: SensitivityRow[]): SensitivityRow[];
// Sort descendente por amplitude — parâmetro mais sensível no topo

export function tornadoBounds(
  rows: SensitivityRow[],
  base: number,
): { min: number; max: number };
// Range simétrico em torno do base, com 5% de pad em cada lado para o maior desvio.
// Vazio: retorna { base × 0.9, base × 1.1 } como fallback.
```

## Componentes — interfaces

```ts
// KpiBaseCard.tsx
type Props = { base: number; horizonYears: number };
// Banner full-width usando KpiCard com feature=true (verde):
//   label: "Patrimônio Imóvel ao fim de N anos"
//   value: formatRs(base)
//   sub:   "horizonte: N anos · cenário base"

// TornadoChart.tsx
type Props = { rows: SensitivityRow[]; base: number };
// SVG ~780×360px (height = 80 + rows.length × 38).
// Layout horizontal por linha:
//   - Coluna esquerda (160px): label do parâmetro, text-anchor end
//   - Coluna meio (flex): track horizontal com base como linha vertical central
//     - Barra coral (#FF5D72) do pessImpact ao base (esquerda)
//     - Barra green (#46E8A4) do base ao optImpact (direita)
//   - Coluna direita (90px): formatRsK(amplitude) — range total (otimista − pessimista)
// Linha vertical central: stroke axis cor #506663, label superior "Base R$ X"
// Eixo X com 3 ticks: pessimista global, base, otimista global
// Linhas pré-ordenadas (sortByImpact aplicado pelo orchestrator)

// SensibilidadeTable.tsx
type Props = { rows: SensitivityRow[] };
// 5 colunas: Parâmetro · Pessimista · Base · Otimista · Amplitude
// Pessimista em coral, otimista em green, base/amplitude em ink.
// Coluna Amplitude = formatRsK(amplitude) — range total absoluto.
// Pattern visual: AllocationTable da Carteira.
```

### `SensibilidadePageContent.tsx`

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
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

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

## Testes

2 arquivos novos:

### `web/tests/sensibilidade-derive.test.ts` (~8 testes — pura)
- `paramLabel("monthly_rent")` → "Aluguel mensal (±20%)"
- `paramLabel("vacancy_months_per_year")` → "Vacância (0–3 meses)"
- `paramLabel("foo_bar")` → "foo_bar" (fallback)
- `enrichRows`: `pessImpact = pessimistic - base`, `amplitude = optimistic - pessimistic`
- `enrichRows([], 100_000)` → `[]`
- `sortByImpact`: ordem decrescente por amplitude
- `tornadoBounds`: simétrico — `(base - min) ≈ (max - base)` (tolerância < 1)
- `tornadoBounds([], 100_000)` → `{ min: 90_000, max: 110_000 }` (fallback)

### `web/tests/sensibilidade-page.test.tsx` (~5 smoke)

Mock `useSimulate` retornando fixture com 6 sensitivity rows e `realEstate.patrimony` ending em valor conhecido. Mock `useScenarioStore` retornando `{ scenario: { horizon: 10 } }`.

- Defaults → KPI banner mostra valor de patrimônio formatado (presente no DOM)
- Renderiza `<svg>` no tornado com 6 grupos (`<g>` ou paths por linha)
- Renderiza tabela com 6 linhas — texto "Aluguel mensal" e "IPTU" presentes
- `sim.isLoading: true` → renderiza `<KpiSkeleton />` (`.animate-pulse` no DOM)
- `sim.error` setado → renderiza `<ErrorCard />` (texto "falha")

Total: ~13 testes em 2 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Sensibilidade → KPI banner: "Patrimônio Imóvel ao fim de 10 anos: **R$ ~393k**" (cenário à vista, defaults)
2. Tornado chart com 6 linhas, ordenadas por impacto: Aluguel mensal no topo (maior amplitude), IR/IPTU embaixo
3. Linha vertical central com label "Base R$ ~393k"
4. Cada linha tem label esquerda, barras coral (pessImpact) / green (optImpact), amplitude total à direita
5. Tabela com 6 linhas, colunas Parâmetro / Pessimista (coral) / Base / Otimista (green) / Amplitude
6. Mexer no Drawer (ex: aumentar aluguel mensal, mudar IPTU) → tornado recalcula automaticamente após aplicar
7. Sem erros no console

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- Permitir o usuário definir os deltas custom por parâmetro (hoje fixos no router)
- Estender sensibilidade para parâmetros da Carteira (yield, capital_gain por classe)
- Two-way sensitivity (combinação de 2 parâmetros num heatmap)
- Comparação de sensibilidades Imóvel vs Carteira lado a lado
- Botão "exportar tornado como CSV/PNG"
