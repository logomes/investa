# Aba Risco MC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `app/risco/page.tsx` por uma aba read-only de análise Monte Carlo: 4 KPIs comparativos + banda p10-p90 + 2 histogramas com linhas verticais p10/p50/p90 (e meta opcional) + loss rate banner condicional.

**Architecture:** A aba consome `useMonteCarlo()` (cache compartilhado com Visão Geral) e `useSimulate()` (apenas para `years`). Tudo derivado client-side via `lib/risco-derive.ts` (riskStats, binDistribution, quantile, lossRateInfo). Banda reusa `LineChart` existente; histograma é um SVG novo `Histogram.tsx` reutilizável.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript, Tailwind v4, shadcn/ui (base-nova), TanStack Query v5, Zustand v5, vitest, @testing-library/react.

**Branch base:** `feat/fase4-risco-mc-spec` (já existe). Implementação em `feat/fase4-risco-mc`.

**Spec:** `docs/superpowers/specs/2026-05-03-fase4-risco-mc-design.md`.

---

## File Structure

**Cria:**
```
web/lib/risco-derive.ts                                       # riskStats + binDistribution + quantile + lossRateInfo
web/components/risco/RiscoPageContent.tsx                     # client wrapper
web/components/risco/KpiRowRisco.tsx                          # bloco 1
web/components/risco/LossRateBanner.tsx                       # bloco 2 (condicional)
web/components/risco/MCBandCard.tsx                           # bloco 3 (wrap LineChart)
web/components/risco/Histogram.tsx                            # SVG genérico
web/components/risco/DistributionCard.tsx                     # bloco 4 (2 Histogram)
web/tests/risco-derive.test.ts                                # ~14 testes
web/tests/histogram.test.tsx                                  # ~3 smoke
web/tests/risco-page.test.tsx                                 # ~6 smoke
```

**Modifica:**
```
web/app/risco/page.tsx                                        # placeholder → wire RiscoPageContent
README.md                                                     # marca aba Risco MC ✅
```

**Não toca:**
- `api/` — `/api/simulate/monte-carlo` já existe e retorna o que precisamos
- Drawer — não tem inputs próprios (Meta R$, nTrajectories já existem em MonteCarloSection)
- `web/lib/api.ts` — `useMonteCarlo`/`useSimulate` já existem

---

## Task 1: Branch + setup

**Files:** working directory state.

- [ ] **Step 1: Confirm starting state**

```bash
cd /home/lucgomes/workspace/investa
git status
git branch --show-current
```
Expected: branch `feat/fase4-risco-mc-spec`, working tree clean.

- [ ] **Step 2: Create implementation branch**

```bash
git checkout -b feat/fase4-risco-mc
```

- [ ] **Step 3: Confirm baseline**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run 2>&1 | tail -5
```
Expected: 27 test files, 155 tests passing (cumulative through Tributação).

---

## Task 2: `lib/risco-derive.ts` — 5 helpers + constante (TDD)

**Files:**
- Create: `web/tests/risco-derive.test.ts`
- Create: `web/lib/risco-derive.ts`

- [ ] **Step 1: Write failing test file**

Create `web/tests/risco-derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  LOSS_RATE_WARNING,
  riskStats,
  binDistribution,
  quantile,
  distributionPercentiles,
  lossRateInfo,
} from "@/lib/risco-derive";
import type { MonteCarloResultOut } from "@/lib/api-types";

const MC: MonteCarloResultOut = {
  label: "Test",
  color: "#27AE60",
  p10: [100, 200, 300],
  p50: [110, 220, 330],
  p90: [120, 240, 360],
  finalDistribution: [100, 200, 300, 400],
  maxDrawdowns: [0.10, 0.20, 0.30, 0.40],
};

describe("risco-derive — riskStats", () => {
  it("retorna finalP10/50/90 = último valor de cada array", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.finalP10).toBe(300);
    expect(s.finalP50).toBe(330);
    expect(s.finalP90).toBe(360);
  });

  it("probTarget = null quando target <= 0", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.probTarget).toBeNull();
  });

  it("probTarget calculado: target=250 → 2/4 finais >= 250 = 0.5", () => {
    const s = riskStats({ result: MC, target: 250, capitalInitial: 0 });
    expect(s.probTarget).toBe(0.5);
  });

  it("lossRate: capitalInitial=250 → 2/4 finais < 250 = 0.5", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 250 });
    expect(s.lossRate).toBe(0.5);
  });

  it("meanMaxDrawdown = média do array", () => {
    const s = riskStats({ result: MC, target: 0, capitalInitial: 0 });
    expect(s.meanMaxDrawdown).toBeCloseTo(0.25, 5);
  });
});

describe("risco-derive — binDistribution", () => {
  it("5 valores uniformes em 5 bins → 1 por bin", () => {
    const bins = binDistribution([1, 2, 3, 4, 5], 5);
    expect(bins).toHaveLength(5);
    bins.forEach((b) => expect(b.count).toBe(1));
  });

  it("array vazio → []", () => {
    expect(binDistribution([])).toEqual([]);
  });

  it("min === max → 1 bin com count = length", () => {
    const bins = binDistribution([5, 5, 5], 3);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
    expect(bins[0].start).toBe(5);
    expect(bins[0].end).toBe(5);
  });

  it("max sempre cai no último bin (closed interval right)", () => {
    const bins = binDistribution([0, 10], 5);
    expect(bins).toHaveLength(5);
    expect(bins[0].count).toBe(1);  // 0
    expect(bins[bins.length - 1].count).toBe(1);  // 10
  });
});

describe("risco-derive — quantile", () => {
  it("quantile mediano de [1..5] = 3", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("quantile 0.25 de [1..5] = 2 (linear interpolation)", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it("quantile 0 = primeiro elemento; quantile 1 = último", () => {
    expect(quantile([10, 20, 30], 0)).toBe(10);
    expect(quantile([10, 20, 30], 1)).toBe(30);
  });
});

describe("risco-derive — distributionPercentiles", () => {
  it("calcula p10/p50/p90 de [1..100]", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const p = distributionPercentiles(values);
    expect(p.p10).toBeCloseTo(10.9, 1);
    expect(p.p50).toBeCloseTo(50.5, 1);
    expect(p.p90).toBeCloseTo(90.1, 1);
  });
});

describe("risco-derive — lossRateInfo", () => {
  it("ambos < 5% → show=false, flagged vazio", () => {
    const info = lossRateInfo({ realEstateRate: 0.02, portfolioRate: 0.01 });
    expect(info.show).toBe(false);
    expect(info.flagged).toEqual([]);
  });

  it("Imóvel 8% → show=true, flagged inclui Imóvel", () => {
    const info = lossRateInfo({ realEstateRate: 0.08, portfolioRate: 0.02 });
    expect(info.show).toBe(true);
    expect(info.flagged).toEqual([{ label: "Imóvel", rate: 0.08 }]);
  });

  it("Carteira 12% → show=true, flagged inclui Carteira", () => {
    const info = lossRateInfo({ realEstateRate: 0.02, portfolioRate: 0.12 });
    expect(info.show).toBe(true);
    expect(info.flagged).toEqual([{ label: "Carteira", rate: 0.12 }]);
  });
});

describe("risco-derive — LOSS_RATE_WARNING", () => {
  it("threshold = 0.05 (5%)", () => {
    expect(LOSS_RATE_WARNING).toBe(0.05);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/risco-derive.test.ts 2>&1 | tail -10
```
Expected: tests fail (module not found).

- [ ] **Step 3: Create implementation**

Create `web/lib/risco-derive.ts`:

```ts
import type { MonteCarloResultOut } from "./api-types";

export const LOSS_RATE_WARNING = 0.05;

// ---------- Per-scenario stats ----------

export type RiskStats = {
  finalP10: number;
  finalP50: number;
  finalP90: number;
  meanMaxDrawdown: number;
  probTarget: number | null;
  lossRate: number;
};

export function riskStats(args: {
  result: MonteCarloResultOut;
  target: number;
  capitalInitial: number;
}): RiskStats {
  const { result, target, capitalInitial } = args;
  const final = result.finalDistribution;
  const probTarget = target > 0
    ? final.filter((v) => v >= target).length / final.length
    : null;
  const lossRate = final.filter((v) => v < capitalInitial).length / final.length;
  const meanDrawdown = result.maxDrawdowns.reduce((s, v) => s + v, 0) / result.maxDrawdowns.length;
  return {
    finalP10: result.p10[result.p10.length - 1],
    finalP50: result.p50[result.p50.length - 1],
    finalP90: result.p90[result.p90.length - 1],
    meanMaxDrawdown: meanDrawdown,
    probTarget,
    lossRate,
  };
}

// ---------- Histogram binning ----------

export type HistogramBin = { start: number; end: number; count: number };

export function binDistribution(values: number[], numBins: number = 30): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ start: min, end: max, count: values.length }];
  const width = (max - min) / numBins;
  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = v >= max ? numBins - 1 : Math.floor((v - min) / width);
    bins[idx].count++;
  }
  return bins;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function distributionPercentiles(values: number[]): {
  p10: number;
  p50: number;
  p90: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.10),
    p50: quantile(sorted, 0.50),
    p90: quantile(sorted, 0.90),
  };
}

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
  threshold?: number;
}): LossRateInfo {
  const threshold = args.threshold ?? LOSS_RATE_WARNING;
  const flagged: Array<{ label: string; rate: number }> = [];
  if (args.realEstateRate > threshold) flagged.push({ label: "Imóvel", rate: args.realEstateRate });
  if (args.portfolioRate > threshold) flagged.push({ label: "Carteira", rate: args.portfolioRate });
  return {
    show: flagged.length > 0,
    realEstateRate: args.realEstateRate,
    portfolioRate: args.portfolioRate,
    flagged,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/risco-derive.test.ts 2>&1 | tail -10
```
Expected: ~17 tests pass (multiple `it` per describe).

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/lib/risco-derive.ts web/tests/risco-derive.test.ts
git commit -m "feat(risco): add risco-derive lib (riskStats, binning, quantile, lossRateInfo)"
```

---

## Task 3: `Histogram.tsx` + tests (TDD)

**Files:**
- Create: `web/tests/histogram.test.tsx`
- Create: `web/components/risco/Histogram.tsx`

- [ ] **Step 1: Write failing test**

Create `web/tests/histogram.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Histogram } from "@/components/risco/Histogram";

const VALUES = Array.from({ length: 100 }, (_, i) => 100_000 + i * 1_000);  // 100..200k linear

describe("Histogram", () => {
  it("renderiza svg com pelo menos 30 elementos rect (bins)", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll("rect").length).toBeGreaterThanOrEqual(30);
  });

  it("renderiza 3 textos com p10/p50/p90", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("p10");
    expect(texts).toContain("p50");
    expect(texts).toContain("p90");
  });

  it("quando target > 0 renderiza linha 'meta' adicional", () => {
    const { container } = render(
      <Histogram
        values={VALUES}
        color="#27AE60"
        percentiles={{ p10: 110_000, p50: 150_000, p90: 190_000 }}
        target={160_000}
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("meta");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/histogram.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create Histogram**

```bash
mkdir -p /home/lucgomes/workspace/investa/web/components/risco
```

Create `web/components/risco/Histogram.tsx`:

```tsx
"use client";

import { binDistribution } from "@/lib/risco-derive";
import { formatRsK } from "@/lib/format";

type Props = {
  values: number[];
  color: string;
  percentiles: { p10: number; p50: number; p90: number };
  target?: number;
  width?: number;
  height?: number;
};

const PAD_LEFT = 30;
const PAD_RIGHT = 12;
const PAD_TOP = 28;
const PAD_BOTTOM = 26;
const PERC_LABEL_Y = 14;
const COLOR_AXIS = "#506663";
const COLOR_INK3 = "#7d9591";
const COLOR_AMBER = "#FFC857";

export function Histogram({
  values,
  color,
  percentiles,
  target,
  width = 360,
  height = 220,
}: Props) {
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  if (values.length === 0) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill={COLOR_INK3} fontSize="11">
          Sem dados
        </text>
      </svg>
    );
  }

  const bins = binDistribution(values, 30);
  const min = bins[0].start;
  const max = bins[bins.length - 1].end;
  const xRange = max - min || 1;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const xOf = (v: number) => PAD_LEFT + ((v - min) / xRange) * innerW;
  const yOf = (count: number) => PAD_TOP + innerH - (count / maxCount) * innerH;

  const verticals: Array<{ x: number; label: string; color: string; dashed: boolean }> = [
    { x: xOf(percentiles.p10), label: "p10", color: COLOR_AXIS, dashed: true },
    { x: xOf(percentiles.p50), label: "p50", color: COLOR_AXIS, dashed: true },
    { x: xOf(percentiles.p90), label: "p90", color: COLOR_AXIS, dashed: true },
  ];
  if (target !== undefined && target > 0 && target >= min && target <= max) {
    verticals.push({ x: xOf(target), label: "meta", color: COLOR_AMBER, dashed: false });
  }

  return (
    <svg width={width} height={height} role="img" aria-label="Distribuição final">
      {/* Bars */}
      {bins.map((b, i) => {
        const x = xOf(b.start);
        const w = Math.max(1, xOf(b.end) - x - 1);
        const y = yOf(b.count);
        const h = PAD_TOP + innerH - y;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={color}
            fillOpacity={0.8}
          />
        );
      })}

      {/* Verticals (percentiles + optional target) */}
      {verticals.map((v) => (
        <g key={v.label}>
          <line
            x1={v.x}
            x2={v.x}
            y1={PAD_TOP - 4}
            y2={PAD_TOP + innerH}
            stroke={v.color}
            strokeWidth={v.label === "meta" ? 1.5 : 1}
            strokeDasharray={v.dashed ? "3 3" : undefined}
          />
          <text
            x={v.x}
            y={PERC_LABEL_Y}
            textAnchor="middle"
            fill={v.color}
            fontSize="10"
            fontWeight={v.label === "meta" ? 700 : 500}
          >
            {v.label}
          </text>
        </g>
      ))}

      {/* X axis ticks: min, ~p50, max */}
      <text
        x={PAD_LEFT}
        y={PAD_TOP + innerH + 14}
        textAnchor="start"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(min)}
      </text>
      <text
        x={xOf(percentiles.p50)}
        y={PAD_TOP + innerH + 14}
        textAnchor="middle"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(percentiles.p50)}
      </text>
      <text
        x={PAD_LEFT + innerW}
        y={PAD_TOP + innerH + 14}
        textAnchor="end"
        fill={COLOR_INK3}
        fontSize="10"
      >
        {formatRsK(max)}
      </text>
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run tests/histogram.test.tsx 2>&1 | tail -10
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/components/risco/Histogram.tsx web/tests/histogram.test.tsx
git commit -m "feat(risco): add Histogram SVG with percentile + target markers"
```

---

## Task 4: `KpiRowRisco.tsx`

**Files:**
- Create: `web/components/risco/KpiRowRisco.tsx`

- [ ] **Step 1: Create component**

Create `web/components/risco/KpiRowRisco.tsx`:

```tsx
"use client";

import { Target, BarChart3, TrendingDown, Activity } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import type { RiskStats } from "@/lib/risco-derive";
import { formatPercent, formatRsK } from "@/lib/format";

type Props = {
  reStats: RiskStats;
  pfStats: RiskStats;
  hasTarget: boolean;
};

export function KpiRowRisco({ reStats, pfStats, hasTarget }: Props) {
  const probMetaValue = hasTarget ? formatPercent(pfStats.probTarget!, 1) : "—";
  const probMetaSub = hasTarget
    ? `Imóvel: ${formatPercent(reStats.probTarget!, 1)}`
    : "configure meta no Drawer";
  const probMetaColor = hasTarget && pfStats.probTarget! >= 0.7 ? "green" : "default";

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="Probabilidade de bater meta"
        value={probMetaValue}
        sub={probMetaSub}
        icon={Target}
        feature={hasTarget}
        valueColor={probMetaColor}
      />
      <KpiCard
        label="Patrimônio mediano (p50)"
        value={formatRsK(pfStats.finalP50)}
        sub={`Imóvel: ${formatRsK(reStats.finalP50)}`}
        icon={BarChart3}
      />
      <KpiCard
        label="Pior cenário (p10)"
        value={formatRsK(pfStats.finalP10)}
        sub={`Imóvel: ${formatRsK(reStats.finalP10)}`}
        icon={TrendingDown}
      />
      <KpiCard
        label="Drawdown médio máx."
        value={formatPercent(pfStats.meanMaxDrawdown, 1)}
        sub={`Imóvel: ${formatPercent(reStats.meanMaxDrawdown, 1)}`}
        icon={Activity}
        valueColor="red"
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
git add web/components/risco/KpiRowRisco.tsx
git commit -m "feat(risco): add KpiRowRisco with 4 comparative KPI cards"
```

---

## Task 5: `LossRateBanner.tsx`

**Files:**
- Create: `web/components/risco/LossRateBanner.tsx`

- [ ] **Step 1: Create component**

Create `web/components/risco/LossRateBanner.tsx`:

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import type { LossRateInfo } from "@/lib/risco-derive";
import { formatRs, formatPercent } from "@/lib/format";

type Props = { info: LossRateInfo; capitalInitial: number };

export function LossRateBanner({ info, capitalInitial }: Props) {
  if (!info.show) return null;
  const flaggedText = info.flagged
    .map((f) => `${f.label} ${formatPercent(f.rate, 1)}`)
    .join("; ");

  return (
    <div className="flex items-start gap-2 bg-accent-amber/10 border border-accent-amber/40 rounded-card p-3">
      <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
      <p className="text-xs text-ink">
        Trajetórias com perda nominal abaixo de {formatRs(capitalInitial)} ao final do horizonte:{" "}
        <span className="font-semibold">{flaggedText}</span>. Considere reduzir alocação em ativos
        de alta σ ou ajustar o horizonte.
      </p>
    </div>
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
git add web/components/risco/LossRateBanner.tsx
git commit -m "feat(risco): add LossRateBanner with conditional render"
```

---

## Task 6: `MCBandCard.tsx` (wrap LineChart)

**Files:**
- Create: `web/components/risco/MCBandCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/risco/MCBandCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { formatRsK } from "@/lib/format";
import type { MonteCarloResultOut } from "@/lib/api-types";

type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  years:      number[];
  nTrajectories: number;
};

export function MCBandCard({ realEstate, portfolio, years, nTrajectories }: Props) {
  const series = [
    { name: `${portfolio.label} p50`,  color: portfolio.color,  values: portfolio.p50,  width: 2 },
    { name: `${realEstate.label} p50`, color: realEstate.color, values: realEstate.p50, width: 2 },
  ];
  const bands = [
    {
      name: `${portfolio.label} p10–p90`,
      color: "rgba(39, 174, 96, 0.18)",
      lower: portfolio.p10,
      upper: portfolio.p90,
    },
    {
      name: `${realEstate.label} p10–p90`,
      color: "rgba(192, 57, 43, 0.14)",
      lower: realEstate.p10,
      upper: realEstate.p90,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Banda de patrimônio (p10–p90)</h3>
          <span className="text-[10px] text-ink-3">
            {nTrajectories.toLocaleString("pt-BR")} trajetórias
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <LineChart
          series={series}
          bands={bands}
          xLabels={years.map(String)}
          height={320}
          yFormat={(v) => formatRsK(v)}
        />
        <p className="text-[10px] text-ink-4 mt-3">
          Linha sólida = p50 (mediano); sombra = intervalo p10–p90 (80% das trajetórias). Seed fixa.
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
git add web/components/risco/MCBandCard.tsx
git commit -m "feat(risco): add MCBandCard wrapping LineChart with p10-p90 bands"
```

---

## Task 7: `DistributionCard.tsx`

**Files:**
- Create: `web/components/risco/DistributionCard.tsx`

- [ ] **Step 1: Create component**

Create `web/components/risco/DistributionCard.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Histogram } from "./Histogram";
import { distributionPercentiles } from "@/lib/risco-derive";
import type { MonteCarloResultOut } from "@/lib/api-types";

type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  target: number;
};

export function DistributionCard({ realEstate, portfolio, target }: Props) {
  const reP = distributionPercentiles(realEstate.finalDistribution);
  const pfP = distributionPercentiles(portfolio.finalDistribution);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Distribuição final do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-medium text-ink mb-2">{portfolio.label}</p>
            <Histogram
              values={portfolio.finalDistribution}
              color={portfolio.color}
              percentiles={pfP}
              target={target}
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-2">{realEstate.label}</p>
            <Histogram
              values={realEstate.finalDistribution}
              color={realEstate.color}
              percentiles={reP}
              target={target}
            />
          </div>
        </div>
        <p className="text-[10px] text-ink-4 mt-3">
          Cada barra agrupa trajetórias com patrimônio final no intervalo. Linhas tracejadas = p10/p50/p90;
          linha sólida amarela = meta (se setada).
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
git add web/components/risco/DistributionCard.tsx
git commit -m "feat(risco): add DistributionCard with 2 Histogram (Carteira | Imóvel)"
```

---

## Task 8: `RiscoPageContent.tsx` + wire route + smoke (TDD)

**Files:**
- Create: `web/components/risco/RiscoPageContent.tsx`
- Create: `web/tests/risco-page.test.tsx`
- Modify: `web/app/risco/page.tsx`

- [ ] **Step 1: Write failing smoke test**

Create `web/tests/risco-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RiscoPageContent } from "@/components/risco/RiscoPageContent";
import type { SimulateMonteCarloOut, SimulateOut } from "@/lib/api-types";

const fakeMcOut: SimulateMonteCarloOut = {
  realEstate: {
    label: "Imóvel",
    color: "#C0392B",
    p10: [230_000, 240_000, 250_000],
    p50: [230_000, 260_000, 290_000],
    p90: [230_000, 280_000, 330_000],
    finalDistribution: Array.from({ length: 100 }, (_, i) => 200_000 + i * 1_500),
    maxDrawdowns: Array.from({ length: 100 }, () => 0.18),
  },
  portfolio: {
    label: "Carteira",
    color: "#27AE60",
    p10: [230_000, 250_000, 270_000],
    p50: [230_000, 270_000, 320_000],
    p90: [230_000, 290_000, 380_000],
    finalDistribution: Array.from({ length: 100 }, (_, i) => 250_000 + i * 1_800),
    maxDrawdowns: Array.from({ length: 100 }, () => 0.22),
  },
};

const fakeSimOut: SimulateOut = {
  realEstate: { years: [0, 1, 2] } as never,
  portfolio: {} as never,
  benchmark: {} as never,
  sensitivity: [] as never,
  taxComparison: [] as never,
};

let mockMc: { data: SimulateMonteCarloOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
let mockSim: { data: SimulateOut | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
let mockStore: { capital: number; targetPatrimony: number; nTrajectories: number };

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { capital: number }; mc: { targetPatrimony: number; nTrajectories: number } }) => T) =>
    selector({
      scenario: { capital: mockStore.capital },
      mc: { targetPatrimony: mockStore.targetPatrimony, nTrajectories: mockStore.nTrajectories },
    }),
}));

vi.mock("@/lib/api", () => ({
  useMonteCarlo: () => mockMc,
  useSimulate: () => mockSim,
  useMacro: () => ({ data: undefined, isLoading: false, error: null }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("RiscoPageContent", () => {
  beforeEach(() => {
    mockMc = { data: fakeMcOut, isLoading: false, error: null, refetch: vi.fn() };
    mockSim = { data: fakeSimOut, isLoading: false, error: null, refetch: vi.fn() };
    mockStore = { capital: 230_000, targetPatrimony: 0, nTrajectories: 2_000 };
  });

  it("renderiza KPIs (Prob meta, p50, p10, drawdown)", () => {
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/probabilidade de bater meta/i)).toBeInTheDocument();
    expect(screen.getByText(/patrimônio mediano/i)).toBeInTheDocument();
    expect(screen.getByText(/pior cenário/i)).toBeInTheDocument();
    expect(screen.getByText(/drawdown médio/i)).toBeInTheDocument();
  });

  it("sem target → KPI Prob meta mostra '—' + sub configure", () => {
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/configure meta/i)).toBeInTheDocument();
  });

  it("com target → KPI Prob meta mostra valor numérico", () => {
    mockStore = { capital: 230_000, targetPatrimony: 350_000, nTrajectories: 2_000 };
    render(wrap(<RiscoPageContent />));
    // probTarget de Carteira: finalDistribution >= 350k
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("loss < 5% nos dois → LossRateBanner não monta", () => {
    // Default fixture: finalDistribution Carteira começa em 250k, Imóvel em 200k.
    // capital=230k → todas Carteira >= 230k (loss=0%); Imóvel ~20% < 230k (loss>5%)
    // Esse caso já dispara o banner. Para testar no-show, baixamos capital.
    mockStore = { capital: 100_000, targetPatrimony: 0, nTrajectories: 2_000 };
    render(wrap(<RiscoPageContent />));
    expect(screen.queryByText(/perda nominal abaixo/i)).not.toBeInTheDocument();
  });

  it("loss > 5% no Imóvel → banner com 'Imóvel'", () => {
    // Default mockStore.capital=230k já faz Imóvel ter loss > 5%
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/perda nominal abaixo/i)).toBeInTheDocument();
    expect(screen.getByText(/Imóvel/)).toBeInTheDocument();
  });

  it("mc.isLoading → renderiza skeleton", () => {
    mockMc = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { container } = render(wrap(<RiscoPageContent />));
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("mc.error → renderiza ErrorCard", () => {
    mockMc = { data: undefined, isLoading: false, error: new Error("boom"), refetch: vi.fn() };
    render(wrap(<RiscoPageContent />));
    expect(screen.getByText(/falha/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/lucgomes/workspace/investa/web
npx vitest run tests/risco-page.test.tsx 2>&1 | tail -10
```
Expected: fails (module not found).

- [ ] **Step 3: Create RiscoPageContent**

Create `web/components/risco/RiscoPageContent.tsx`:

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
    return (
      <ErrorCard
        onRetry={() => {
          mc.refetch();
          sim.refetch();
        }}
      />
    );
  }

  const data = mc.data!;
  const years = sim.data!.realEstate.years;
  const reStats = riskStats({ result: data.realEstate, target, capitalInitial: capital });
  const pfStats = riskStats({ result: data.portfolio, target, capitalInitial: capital });
  const lossInfo = lossRateInfo({
    realEstateRate: reStats.lossRate,
    portfolioRate: pfStats.lossRate,
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

- [ ] **Step 4: Wire route**

Replace entire content of `web/app/risco/page.tsx`:

```tsx
import { RiscoPageContent } from "@/components/risco/RiscoPageContent";

export default function RiscoPage() {
  return <RiscoPageContent />;
}
```

- [ ] **Step 5: Run smoke + typecheck**

```bash
cd /home/lucgomes/workspace/investa/web
npx tsc --noEmit 2>&1 | tail -3
npx vitest run tests/risco-page.test.tsx 2>&1 | tail -10
```
Expected: typecheck clean; 7 smoke tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: 155 (baseline) + ~17 (derive) + 3 (histogram) + 7 (page) = ~182 tests passing.

- [ ] **Step 7: Run Next build (catches ESLint stricter than tsc)**

```bash
cd /home/lucgomes/workspace/investa/web && pnpm run build 2>&1 | tail -15
```
Expected: build succeeds; `/risco` route ≥ a few KB.

- [ ] **Step 8: Commit**

```bash
cd /home/lucgomes/workspace/investa
git add web/app/risco/page.tsx \
        web/components/risco/RiscoPageContent.tsx \
        web/tests/risco-page.test.tsx
git commit -m "feat(risco): wire RiscoPageContent + smoke tests"
```

---

## Task 9: README + push + smoke prod + merge

**Files:** `README.md`

- [ ] **Step 1: Update README**

Edit `README.md`. Find `- ⬜ Risco MC` e substitua por:
```
  - ✅ Risco MC (KPIs comparativos, banda p10-p90, histogramas, loss rate banner)
```

- [ ] **Step 2: Commit + push**

```bash
cd /home/lucgomes/workspace/investa
git add README.md
git commit -m "docs: mark aba Risco MC complete"
git push -u origin feat/fase4-risco-mc
```

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge feat/fase4-risco-mc
git push origin main
```

- [ ] **Step 4: Smoke prod (após Vercel rebuild ~2 min)**

Open `https://investa-beta.vercel.app/risco`. Verify:

1. **4 KPIs**: Prob meta (— se sem meta, "configure meta no Drawer"), p50 mediano, p10 pior caso, drawdown médio (red)
2. **Banda chart full-width**: 2 séries p50 (Carteira green / Imóvel coral) + 2 sombras p10-p90; legenda "trajetórias"
3. **2 Histogramas lado a lado**: 30 bins, linhas tracejadas em p10/p50/p90 com labels
4. **Setar Meta R$ 600.000** no Drawer + aplicar → KPI "Prob meta" mostra valor; ambos histogramas mostram linha vertical amarela "meta"
5. **Loss rate banner**: aparece se algum cenário > 5% de trajetórias < capital; some quando ≤ 5%
6. **Mudar nTrajectories** no Drawer (2000 → 5000) e aplicar → tudo recalcula (banda, histogramas, KPIs)
7. Sem erros no console; tempo de render do MC ≤ 5s no cold start (Render free tier)

- [ ] **Step 5: Cleanup branches**

```bash
git branch -d feat/fase4-risco-mc feat/fase4-risco-mc-spec
git push origin --delete feat/fase4-risco-mc
```

---

## Done criteria

- 9 tasks concluídas
- ~27 testes novos (17 derive + 3 histogram + 7 page); suite total ≥ 182
- Aba `/risco` em produção com KPIs + banda + 2 histogramas + banner condicional
- README atualizado, branches deletadas
- **Próxima e última aba da Fase 4: Exportar** (CSV download)
