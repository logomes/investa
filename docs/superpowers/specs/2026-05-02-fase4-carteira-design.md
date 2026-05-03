# Aba Carteira — Design (Fase 4)

**Data:** 2026-05-02
**Status:** Aprovado pelo usuário (decisões A/B/A registradas em conversa)
**Fase do projeto:** Fase 4 / aba 3 de 7 (após Renda Fixa e Imóvel)

---

## Objetivo

Substituir o placeholder de `app/carteira/page.tsx` por uma aba de análise read-only da carteira diversificada configurada no cenário global. A aba consome `scenario.portfolio` (Zustand) e `useMacro()` (TanStack) para mostrar KPIs blended, donut de alocação, tabela detalhada, e comparação de yields contra Imóvel e Tesouro Selic com linhas de referência Selic/IPCA.

## Decisões de design

1. **Papel da aba**: read-only. Edição vive no Drawer (`PortfolioSection` já existente). (Decisão A da pergunta 1.)
2. **Yield comparison**: derivar tudo do cenário (Carteira, Imóvel bruto/líquido, Tesouro Selic líquido) — sem benchmarks externos hardcoded. (Decisão B da pergunta 2.)
3. **Visualização da alocação**: SVG donut inline. (Decisão A da pergunta 3.)
4. **Escopo**: 4 blocos — KPIs (4 cards), Donut, Tabela detalhamento, Yield comparison com refs Selic/IPCA.

## Arquitetura

### Estrutura de arquivos

```
web/app/carteira/page.tsx                                    # rota (server)
web/components/carteira/
  CarteiraPageContent.tsx                                    # client wrapper
  KpiRowCarteira.tsx                                         # bloco 1
  AllocationDonutCard.tsx                                    # bloco 2
  AllocationTable.tsx                                        # bloco 3
  YieldComparisonCard.tsx                                    # bloco 4
web/lib/carteira-derive.ts                                   # fórmulas + paleta + donut geometry
```

Sem store próprio. `scenario.portfolio` (em `useScenarioStore`) é a fonte canônica. `useMacro()` provê macro para yield comparison + reference lines. `lib/imovel-derive.ts` é importado para `grossYield`/`netYield` (paridade de números entre as abas).

### Data flow

```
CarteiraPageContent
├── useScenarioStore() → scenario.portfolio + scenario.realEstate + scenario.benchmark.taxRate
├── useMacro() → { selic, ipca, ... }                        (loading/error states tratados)
└── lib/carteira-derive.ts (puro)
    ├── blendedYield, blendedCapitalGain, totalReturn, annualIncome
    ├── normalizedWeights (caso pesos não somem 1)
    ├── allocationSegments → 5 entradas com cor consistente
    ├── yieldComparison → 4 barras
    ├── yieldRefLines → 2 linhas (Selic, IPCA)
    └── donutSlices → SVG path d-strings
```

Cards consomem dados derivados (não lêem store). Orchestrator alimenta.

### Layout (`CarteiraPageContent.tsx`)

```
┌─────────────────────────────────────────────────┐
│  KpiRowCarteira (4 cards)                       │
├──────────────────────┬──────────────────────────┤
│  AllocationDonutCard │  AllocationTable         │
├──────────────────────┴──────────────────────────┤
│  YieldComparisonCard (full width)               │
└─────────────────────────────────────────────────┘
```

Estados: `<KpiSkeleton />` enquanto `useMacro` carrega; `<ErrorCard />` em caso de erro do `/api/macro`. Donut e tabela renderizam imediatamente do scenario (não dependem de rede).

## `lib/carteira-derive.ts` — API

Funções puras espelhando `PortfolioParams` do engine Python (`api/core/config.py`).

```ts
import type { PortfolioInput, RealEstateInput, MacroOut } from "./api-types";

// ---------- KPIs blended ----------

blendedYield(pf: PortfolioInput): number
// Σ weight_i × expectedYield_i × (1 - taxRate_i)

blendedCapitalGain(pf: PortfolioInput): number
// Σ weight_i × capitalGain_i

totalReturn(pf: PortfolioInput): number
// blendedYield + blendedCapitalGain

annualIncome(pf: PortfolioInput): number
// pf.capital * blendedYield(pf)

// ---------- Pesos ----------

normalizedWeights(pf: PortfolioInput): number[]
// length === pf.assets.length
// Se Σweights > 0: divide cada por Σ. Se Σweights = 0: retorna zeros.

// ---------- Allocation segments (bloco 2 + 3) ----------

export type AllocationSegment = {
  name: string;
  weight: number;          // já normalizado [0,1]
  amount: number;          // pf.capital * weight
  expectedYield: number;
  taxRate: number;
  netYield: number;        // expectedYield * (1 - taxRate)
  color: string;           // ASSET_COLORS[index]
};

allocationSegments(pf: PortfolioInput): AllocationSegment[]
// length === pf.assets.length

// ---------- Yield comparison (bloco 4) ----------

export type YieldRow = { label: string; value: number; color: string };

yieldComparison(args: {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;        // scenario.benchmark.taxRate (~0.175)
  macro: MacroOut;
}): YieldRow[]
// Retorna 4 entradas em ordem fixa:
// 0 — "Carteira blended"      → blendedYield(pf)                      color "#46E8A4"
// 1 — "Imóvel bruto"          → grossYield(re)  (de imovel-derive)    color "#FFC857"
// 2 — "Imóvel líquido"        → netYield(re)    (de imovel-derive)    color "#FF6B5B"
// 3 — "Tesouro Selic líquido" → macro.selic * (1 - benchmarkTaxRate)  color "#5CC8FF"

export type RefLine = { label: string; value: number };
yieldRefLines(macro: MacroOut): RefLine[]
//   [{ "Selic", macro.selic }, { "IPCA", macro.ipca }]

// ---------- Paleta ----------

export const ASSET_COLORS: string[] = [
  "#FFC857",  // 0 — amber
  "#FF6B5B",  // 1 — coral
  "#5CC8FF",  // 2 — cyan
  "#46E8A4",  // 3 — green
  "#C39BD3",  // 4 — purple
  "#FFB088",  // 5 — fallback (>5 classes)
  "#7DCFFF",  // 6 — fallback
  "#A2E5C0",  // 7 — fallback
];

// ---------- Donut geometry ----------

export type DonutSlice = {
  path: string;            // SVG `d` string
  color: string;
  midAngle: number;        // radianos — útil pra label opcional
};

donutSlices(args: {
  segments: AllocationSegment[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
}): DonutSlice[]

// Algoritmo:
//  - Filtra segmentos com weight === 0 (não geram path; a tabela ainda mostra a linha vazia)
//  - Para cada segmento restante com weight w_i, ângulo = w_i * 2π
//  - Acumula cumulativeAngle de 0 a 2π, sempre começando no topo (-π/2)
//  - Path: M (outer-start) A (outer-arc) L (inner-end) A (inner-arc) Z
//  - largeArcFlag = w_i > 0.5 ? 1 : 0
//  - Convenção pra weight = 1 (única classe não-zero): split em 2 arcos de 180°
//    (M outer-top, A 180° → outer-bottom, A 180° → outer-top, L inner-top,
//    A 180° → inner-bottom, A 180° → inner-top, Z) para evitar arc degenerado
```

## Componentes — interfaces

```ts
// KpiRowCarteira.tsx
type Props = { pf: PortfolioInput };
// 4 KpiCards lado a lado:
//  - "DY blended"             → formatPercent(blendedYield(pf), 2)
//  - "Ganho de capital esp."  → formatPercent(blendedCapitalGain(pf), 2)
//  - "Retorno total a.a."     → formatPercent(totalReturn(pf), 2)   ← featured (verde)
//  - "Renda anual estimada"   → formatRs(annualIncome(pf))

// AllocationDonutCard.tsx
type Props = { pf: PortfolioInput };
// Header: "Alocação por classe"
// SVG donut centrado (~280×280px): cx=140, cy=140, outerR=110, innerR=70
//   fatias coloridas com paths de donutSlices()
//   centro: formatRsK(pf.capital) em fonte grande + "alocados" em ink-3
// Legenda abaixo: 5 itens (bullet colorido + nome + peso%) em grid 2-col

// AllocationTable.tsx
type Props = { pf: PortfolioInput };
// 5 colunas: Classe · Peso · Valor · Yield Esp. · IR
// Linhas usam allocationSegments — primeira col tem bullet colorido coerente com donut
// Pattern visual: PositionsTable da Renda Fixa (tabular, sem hover, font tabular)

// YieldComparisonCard.tsx
type Props = {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;
  macro: MacroOut;
};
// 4 barras horizontais com %; eixo X de 0 a Math.max(...yields, refs) + 2pp folga
// Cada barra: altura 28px, label esquerda (nome), label direita ("X,XX%")
// 2 linhas verticais tracejadas (Selic, IPCA) com label superior "Selic X,XX%"
// Footer: nota "linhas tracejadas = referência macro atual"
```

### Layout completo (`CarteiraPageContent.tsx`)

```tsx
const scenario = useScenarioStore((s) => s.scenario);
const macro = useMacro();

if (macro.isLoading) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
    </div>
  );
}
if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;

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
```

## Testes

3 arquivos novos:

### `web/tests/carteira-derive.test.ts` (~12-15 testes)
Fixture: `DEFAULT_SCENARIO.portfolio` + macro mock.

- `blendedYield` ≈ 0,06432 (defaults)
- `blendedCapitalGain` ≈ 0,024
- `totalReturn` ≈ 0,08832
- `annualIncome` ≈ R$ 14.794
- `normalizedWeights`: pesos `[0.5, 0.5, 0]` → `[0.5, 0.5, 0]`; pesos `[1, 1, 0]` → `[0.5, 0.5, 0]`; pesos `[0, 0, 0]` → `[0, 0, 0]`
- `allocationSegments` length = pf.assets.length, Σweight = 1, Σamount = pf.capital
- `yieldComparison` retorna 4 entradas em ordem fixa
- `yieldRefLines` retorna `[{Selic, 0.1475}, {IPCA, 0.048}]` para macro mock
- IR=100% (taxRate=1) → contribuição daquele asset ao blendedYield = 0
- Capital = 0 → annualIncome = 0
- Asset com weight=0 → segmento com amount=0, sem dividir-por-zero
- `ASSET_COLORS` tem ≥5 entradas

### `web/tests/donut-slices.test.ts` (~5 testes — geometria pura)

- 5 segmentos uniformes (0.2 cada) → cada slice cobre 72° (π/5 rad)
- 1 segmento (weight=1) → path com 2 arcos de 180° (anel completo sem degeneração)
- Segmentos com weight=0 são filtrados (donutSlices retorna length < segments.length)
- 2 segmentos iguais (0.5/0.5) → 180° cada, largeArcFlag=0 (limite — convenção)
- Cores correspondem a `ASSET_COLORS[i]`
- `midAngle` aponta para o centro angular de cada slice

### `web/tests/carteira-page.test.tsx` (~5 smoke)

Mock `useMacro` retornando `{ data: MACRO_FIXTURE, isLoading: false, error: null }` (pattern do `imovel-page.test.tsx`).

- Defaults → KPIs visíveis (texto "DY blended", "Retorno total")
- Macro loading → `<KpiSkeleton />` aparece
- Macro error → `<ErrorCard />` aparece
- Renderiza `<svg>` (donut) e tabela (linhas com FIIs/Ações/Tesouro)
- Renderiza 4 barras de comparação (texto "Carteira blended", "Imóvel bruto", "Imóvel líquido", "Tesouro Selic líquido")

Total: ~22-25 testes em 3 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Carteira → KPIs: DY blended **6,43%**, Ganho capital **2,40%**, Retorno total **8,83%**, Renda anual **R$ 14.794** (com defaults: capital R$ 230k, 5 classes definidas)
2. Donut renderiza 5 fatias coloridas com `R$ 230k` no centro + label "alocados"
3. Tabela 5 linhas, bullet colorido coerente com donut, valores: FIIs Papel R$ 57.500 (25%), FIIs Tijolo R$ 57.500 (25%), Ações BR R$ 46.000 (20%), Dividend US R$ 34.500 (15%), Tesouro IPCA+ R$ 34.500 (15%)
4. Yield comparison: 4 barras com Carteira ~6,43%, Imóvel bruto ~7,83%, Imóvel líquido ~4,20%, Tesouro Selic líq ~12,17% (14,75% × 0,825)
5. Linhas tracejadas Selic 14,75% e IPCA ~4,14% visíveis no chart
6. Mexer no Drawer (peso ou yield esperado de qualquer ativo) → KPIs, donut e tabela atualizam ao aplicar cenário
7. Sem erros no console

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- Edição inline na própria aba (espelho do Drawer) — registrado em conversa para fase futura
- Importação CSV de carteira (analogia com Renda Fixa)
- Volatilidade ponderada da carteira (vai aparecer em Risco MC)
- Rebalanceamento sugerido / drift alert (target weights vs current)
- Per-asset detalhe expandível com `note` (ex: "HGCR11, KNCR11, RBRR11 — isento PF")
- Comparação histórica (yields backtest com data macro real do BCB)
