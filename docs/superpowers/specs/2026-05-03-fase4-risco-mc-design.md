# Aba Risco MC — Design (Fase 4)

**Data:** 2026-05-03
**Status:** Aprovado pelo usuário (decisões B/A/C/B/A registradas em conversa)
**Fase do projeto:** Fase 4 / aba 6 de 7 (após Renda Fixa, Imóvel, Carteira, Sensibilidade, Tributação)

---

## Objetivo

Substituir o placeholder de `app/risco/page.tsx` por uma aba de análise read-only de risco baseada em Monte Carlo. Mostra a distribuição de patrimônios finais entre Imóvel e Carteira, percentis ao longo do horizonte, drawdown médio máximo, probabilidade de bater meta (se setada) e alerta se trajetórias terminarem abaixo do capital inicial.

## Decisões de design

1. **Papel da aba**: read-only (consistente com as 5 anteriores). Sem inputs próprios; configuração via Drawer.
2. **KPIs**: 4 cards comparativos (Carteira value, Imóvel sub) — decisão B da pergunta 1.
3. **Charts**: banda p10-p90 + 2 histogramas lado a lado — decisão A da pergunta 2.
4. **Banda**: reusa `LineChart` existente via wrapper `MCBandCard` — decisão C da pergunta 3.
5. **Histograma**: SVG novo `Histogram.tsx` com 3 linhas verticais p10/p50/p90 — decisão B da pergunta 4.
6. **Loss rate**: banner condicional acima dos KPIs — decisão A da pergunta 5. Threshold 5% (espelha `LOSS_RATE_WARNING_THRESHOLD` do Streamlit).
7. **Source**: `useMonteCarlo()` (cache compartilhado com Visão Geral). `useSimulate()` complementa apenas para o array `years` do eixo X.

## Arquitetura

### Estrutura de arquivos

```
web/app/risco/page.tsx                                       # rota (server)
web/components/risco/
  RiscoPageContent.tsx                                       # client wrapper (orchestrator)
  KpiRowRisco.tsx                                            # bloco 1
  LossRateBanner.tsx                                         # bloco 2 (condicional)
  MCBandCard.tsx                                             # bloco 3 (wrap LineChart)
  DistributionCard.tsx                                       # bloco 4 (2 Histogram)
  Histogram.tsx                                              # SVG genérico reutilizável
web/lib/risco-derive.ts                                      # riskStats + binDistribution + quantile + lossRateInfo + LOSS_RATE_WARNING
```

Sem store próprio. `useMonteCarlo()` e `useSimulate()` (do `lib/api.ts`) já gerenciam cache.

### Data flow

```
RiscoPageContent
├── useScenarioStore
│   ├── scenario.capital            (baseline pra loss rate)
│   ├── mc.targetPatrimony          (meta opcional, 0 = sem meta)
│   └── mc.nTrajectories            (caption da banda)
├── useMonteCarlo() → { realEstate, portfolio }   (TanStack — cache compartilhado)
├── useSimulate() → realEstate.years              (eixo X — já em cache)
└── lib/risco-derive.ts (puro)
    ├── riskStats({ result, target, capitalInitial }) → RiskStats
    ├── lossRateInfo({ reRate, pfRate }) → LossRateInfo
    ├── binDistribution(values, numBins) → HistogramBin[]
    ├── quantile(sorted, q)
    └── distributionPercentiles(values) → { p10, p50, p90 }
```

### Layout

```
┌──────────────────────────────────────────────┐
│  LossRateBanner (condicional, só se >5%)     │
├──────────────────────────────────────────────┤
│  KpiRowRisco (4 cards comparativos)          │
├──────────────────────────────────────────────┤
│  MCBandCard (banda p10-p90, full width)      │
├────────────────────────┬─────────────────────┤
│  Histogram Carteira    │  Histogram Imóvel   │
└────────────────────────┴─────────────────────┘
```

Estados:
- `<KpiSkeleton /> × 4` enquanto qualquer query carrega
- `<ErrorCard onRetry={...refetch} />` em erro de qualquer query
- Sem target → KPI "Prob meta" mostra "—" + sub "configure meta no Drawer" (não erro)
- Sem alguma feature do MC → degradação silenciosa (não bloqueia o resto)

## `lib/risco-derive.ts` — API

```ts
import type { MonteCarloResultOut } from "./api-types";

export const LOSS_RATE_WARNING = 0.05;

// ---------- Per-scenario stats ----------

export type RiskStats = {
  finalP10: number;
  finalP50: number;
  finalP90: number;
  meanMaxDrawdown: number;
  probTarget: number | null;     // null se target <= 0
  lossRate: number;              // fração da finalDistribution < capitalInitial
};

export function riskStats(args: {
  result: MonteCarloResultOut;
  target: number;
  capitalInitial: number;
}): RiskStats;

// ---------- Histogram binning ----------

export type HistogramBin = { start: number; end: number; count: number };

// Retorna numBins bins iguais entre min e max. Se min === max ou values vazio,
// trata edge cases (1 bin com todos os valores ou array vazio).
// Closed interval na ponta direita: max sempre cai no último bin.
export function binDistribution(values: number[], numBins?: number): HistogramBin[];

// Linear interpolation entre os 2 valores adjacentes do array já ordenado.
export function quantile(sorted: number[], q: number): number;

// Calcula p10/p50/p90 sobre os valores brutos (ordena internamente).
export function distributionPercentiles(values: number[]): {
  p10: number;
  p50: number;
  p90: number;
};

// ---------- Loss rate banner ----------

export type LossRateInfo = {
  show: boolean;
  realEstateRate: number;
  portfolioRate: number;
  flagged: Array<{ label: string; rate: number }>;
};

export function lossRateInfo(args: {
  realEstateRate: number;
  portfolioRate: number;
  threshold?: number;            // default LOSS_RATE_WARNING
}): LossRateInfo;
```

## Componentes — interfaces

```tsx
// KpiRowRisco.tsx
type Props = {
  reStats: RiskStats;
  pfStats: RiskStats;
  hasTarget: boolean;
};
// 4 KpiCards comparativos (value = Carteira; sub = "Imóvel: X"):
//
//  0 — "Probabilidade de bater meta"
//      hasTarget ? formatPercent(pfStats.probTarget!, 1) : "—"
//      sub: hasTarget ? `Imóvel: ${formatPercent(reStats.probTarget!, 1)}` : "configure meta no Drawer"
//      valueColor: hasTarget && pfStats.probTarget! >= 0.7 ? "green" : "default"
//      icon: Target
//      feature: hasTarget
//
//  1 — "Patrimônio mediano (p50)"
//      formatRsK(pfStats.finalP50)
//      sub: `Imóvel: ${formatRsK(reStats.finalP50)}`
//      icon: BarChart3
//
//  2 — "Pior cenário (p10)"
//      formatRsK(pfStats.finalP10)
//      sub: `Imóvel: ${formatRsK(reStats.finalP10)}`
//      icon: TrendingDown
//
//  3 — "Drawdown médio máx."
//      formatPercent(pfStats.meanMaxDrawdown, 1)
//      sub: `Imóvel: ${formatPercent(reStats.meanMaxDrawdown, 1)}`
//      icon: Activity
//      valueColor: "red"

// LossRateBanner.tsx
type Props = { info: LossRateInfo; capitalInitial: number };
// Renderiza null se !info.show.
// Banner amarelo (bg-accent-amber/10 + border-accent-amber/40, AlertTriangle).
// Texto: "Trajetórias com perda nominal abaixo de R$ {capital}: {flagged.map → 'Imóvel 8%'}.join('; ').
//        Considere reduzir alocação em ativos de alta σ ou ajustar o horizonte."
// Pattern visual: warning do FinancingCard da aba Imóvel.

// MCBandCard.tsx
type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  years:      number[];
  nTrajectories: number;
};
// Card com header "Banda de patrimônio (p10–p90)" + caption explicativa.
// Caption: "Baseado em {nTrajectories.toLocaleString('pt-BR')} trajetórias com seed fixa.
//           Linha sólida = p50 (mediano); sombra = intervalo p10–p90 (80% das trajetórias)."
// Renderiza <LineChart> existente com:
//   series: [
//     { name: "Carteira p50", color: portfolio.color,  values: portfolio.p50,  width: 2 },
//     { name: "Imóvel p50",   color: realEstate.color, values: realEstate.p50, width: 2 },
//   ]
//   bands: [
//     { name: "Carteira p10-p90", color: "rgba(39, 174, 96, 0.18)",  lower: portfolio.p10,  upper: portfolio.p90 },
//     { name: "Imóvel p10-p90",   color: "rgba(192, 57, 43, 0.14)", lower: realEstate.p10, upper: realEstate.p90 },
//   ]
//   (rgba values hardcoded — espelha pattern do EvolutionCard de Visão Geral)
//   xLabels: years.map(String)
//   height: 320

// Histogram.tsx
type Props = {
  values: number[];
  color: string;
  percentiles: { p10: number; p50: number; p90: number };
  target?: number;        // se > 0, linha vertical adicional
  width?: number;         // default 360
  height?: number;        // default 220
};
// SVG inline:
//  - 30 bins via binDistribution(values, 30)
//  - Eixo X com 3 ticks: min, ~p50, max — formatRsK
//  - Bars com altura proporcional ao count máximo
//  - 3 linhas verticais tracejadas em p10/p50/p90, label superior pequeno ("p10")
//  - 1 linha vertical sólida em target (se > 0) cor accent-amber, label "meta"

// DistributionCard.tsx
type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  target: number;
};
// Card com header "Distribuição final do patrimônio".
// Grid 2-col com 2 Histogram (Carteira pf.color | Imóvel re.color).
// Cada histogram tem mini-header com nome do cenário acima.
// Caption: "Cada barra agrupa trajetórias com patrimônio final no intervalo X-Y.
//           Linhas tracejadas = p10/p50/p90; linha sólida = meta (se setada)."
```

### `RiscoPageContent.tsx`

```tsx
"use client";

import { useMonteCarlo, useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { riskStats, lossRateInfo } from "@/lib/risco-derive";
import { LossRateBanner } from "./LossRateBanner";
import { KpiRowRisco } from "./KpiRowRisco";
import { MCBandCard } from "./MCBandCard";
import { DistributionCard } from "./DistributionCard";

export function RiscoPageContent() {
  const capital = useScenarioStore((s) => s.scenario.capital);
  const target = useScenarioStore((s) => s.mc.targetPatrimony);
  const nTrajectories = useScenarioStore((s) => s.mc.nTrajectories);
  const mc = useMonteCarlo();
  const sim = useSimulate();

  if (mc.isLoading || sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (mc.error || sim.error) {
    return <ErrorCard onRetry={() => { mc.refetch(); sim.refetch(); }} />;
  }

  const data = mc.data!;
  const years = sim.data!.realEstate.years;
  const reStats = riskStats({ result: data.realEstate, target, capitalInitial: capital });
  const pfStats = riskStats({ result: data.portfolio,  target, capitalInitial: capital });
  const lossInfo = lossRateInfo({
    realEstateRate: reStats.lossRate,
    portfolioRate:  pfStats.lossRate,
  });

  return (
    <div className="space-y-6">
      <LossRateBanner info={lossInfo} capitalInitial={capital} />
      <KpiRowRisco reStats={reStats} pfStats={pfStats} hasTarget={target > 0} />
      <MCBandCard
        realEstate={data.realEstate}
        portfolio={data.portfolio}
        years={years}
        nTrajectories={nTrajectories}
      />
      <DistributionCard
        realEstate={data.realEstate}
        portfolio={data.portfolio}
        target={target}
      />
    </div>
  );
}
```

## Testes

3 arquivos novos:

### `web/tests/risco-derive.test.ts` (~14 testes — pura)
- `riskStats` retorna `finalP10/50/90` = último valor dos arrays
- `riskStats.probTarget = null` quando target=0
- `riskStats.probTarget` correto: `[100,200,300,400]`, target=250 → 0.5
- `riskStats.lossRate`: mesmo fixture, capitalInitial=250 → 0.5
- `riskStats.meanMaxDrawdown` = média do array
- `binDistribution([1,2,3,4,5], 5)` → 5 bins, count 1 cada
- `binDistribution([])` → []
- `binDistribution([5,5,5], 3)` → 1 bin com count 3 (min === max)
- `binDistribution`: max sempre cai no último bin
- `quantile([1,2,3,4,5], 0.5)` = 3
- `quantile([1,2,3,4,5], 0.25)` = 2 (linear interp)
- `distributionPercentiles([1..100])` → p10≈10.9, p50≈50.5, p90≈90.1
- `lossRateInfo`: ambos < 5% → show=false
- `lossRateInfo`: re=0.08 → show=true, flagged inclui "Imóvel"
- `LOSS_RATE_WARNING === 0.05`

### `web/tests/histogram.test.tsx` (~3 smoke)
- Renderiza `<svg>` com pelo menos 30 elementos `<rect>` (bins)
- Quando `target > 0`, renderiza linha vertical adicional (label "meta")
- Renderiza 3 textos com "p10/p50/p90"

### `web/tests/risco-page.test.tsx` (~6 smoke)

Mocks: `useMonteCarlo`, `useSimulate`, `useScenarioStore`.

- Defaults → KPIs visíveis ("Probabilidade de bater meta", "Drawdown médio máx.")
- Sem target → KPI "Prob meta" mostra "—"
- Com target → KPI mostra valor formatado
- Loss < 5% nos dois → LossRateBanner não monta
- Loss > 5% no Imóvel → banner monta com texto "Imóvel"
- mc.isLoading → renderiza skeleton
- mc.error → renderiza ErrorCard

Total: ~23 testes em 3 arquivos.

## Critérios de aceite (smoke produção)

1. Sidebar → Risco MC → 4 KPIs (Prob meta, p50, p10, drawdown) com 2 valores cada (Carteira value + Imóvel sub)
2. Banda p10-p90 full width: 2 séries (Carteira p50 verde, Imóvel p50 coral) + 2 sombras
3. 2 histogramas lado a lado com 30 bins, linhas tracejadas em p10/p50/p90
4. Setar `Meta R$ 600.000` no Drawer → linha vertical em ambos os histogramas + KPI "Prob meta" com valor numérico
5. Loss rate banner aparece se algum cenário > 5%; some quando ≤ 5% nos dois
6. Mudar `nTrajectories: 2000 → 5000` no Drawer → tudo recalcula ao aplicar
7. Sem erros no console; tempo de render do MC ≤ 5s no cold start (Render free tier)

## Trabalho fora de escopo (FUTURE_IMPROVEMENTS)

- Tabela de percentis (p10/p50/p90 ano a ano, exportável CSV)
- VaR e CVaR (Conditional Value at Risk) como KPIs adicionais
- Stress testing (cenários macro extremos como inputs do Drawer: σ × 2, choque inflacionário)
- Correlação entre Imóvel e Carteira (hoje independentes — limitação documentada do engine)
- Histogramas sobrepostos (Carteira + Imóvel) para comparação direta
- Ajustar `LOSS_RATE_WARNING` por usuário no Drawer
