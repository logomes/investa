# Goal Recommender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded "R$ 800/mês → 91%" advice in `GoalCard` with a real recommender. Suggested aporte comes from a closed-form FV equation; the "% provável" badge comes from Monte Carlo `finalDistribution`. "Aplicar sugestão" mutates `scenario.portfolio.monthlyContribution`.

**Architecture:** New pure module `web/lib/goal-recommend.ts` (deterministic FV math + probability helper). `GoalCard.tsx` reads recommendation + MC and renders one of four states (already-met / already-on-track / below / unreachable). Apply button calls `setScenario`, React Query refetches, everything updates reactively. No backend changes.

**Tech Stack:** TypeScript, vitest, @testing-library/react, Zustand, @tanstack/react-query.

**Spec:** `docs/superpowers/specs/2026-05-13-goal-recommender-design.md`

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `web/lib/goal-recommend.ts` | Create | Pure module: `recommend()` + `goalProbability()` |
| `web/tests/goal-recommend.test.ts` | Create | Unit tests for pure math, all states + edge cases |
| `web/components/visao-geral/GoalCard.tsx` | Modify | Read recommendation, render 4 states, wire Apply button |
| `web/tests/goal-card.test.tsx` | Modify | Update mocks for new hook usage; add state rendering + Apply button tests |

No backend changes. No store changes (`setScenario` already exists in `web/lib/store.ts`).

---

## Task 1: Pure module `goal-recommend.ts`

**Files:**
- Create: `web/lib/goal-recommend.ts`
- Test: `web/tests/goal-recommend.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/goal-recommend.test.ts` with the following content:

```ts
import { describe, it, expect } from "vitest";
import { recommend, goalProbability } from "@/lib/goal-recommend";

const BASE = {
  goal: 1_000_000,
  capital: 200_000,
  horizonYears: 10,
  currentMonthlyContribution: 1_000,
  contributionInflationIndexed: false,
  totalReturnAnnualNet: 0.08,
  projectedFinalPatrimony: 600_000,
  expectedInflation: 0.04,
};

describe("recommend", () => {
  it("already-met when capital >= goal", () => {
    const r = recommend({ ...BASE, capital: 1_500_000 });
    expect(r.state).toBe("already-met");
  });

  it("already-on-track when projectedFinal >= goal", () => {
    const r = recommend({ ...BASE, projectedFinalPatrimony: 1_100_000 });
    expect(r.state).toBe("already-on-track");
    if (r.state === "already-on-track") {
      expect(r.projectedFinal).toBe(1_100_000);
    }
  });

  it("below: classic case returns positive delta and suggested = current + delta", () => {
    const r = recommend(BASE);
    expect(r.state).toBe("below");
    if (r.state === "below") {
      expect(r.deltaMonthly).toBeGreaterThan(0);
      expect(r.suggestedMonthly).toBeCloseTo(BASE.currentMonthlyContribution + r.deltaMonthly, 5);
    }
  });

  it("below with current=0: suggested equals delta", () => {
    const r = recommend({ ...BASE, currentMonthlyContribution: 0 });
    expect(r.state).toBe("below");
    if (r.state === "below") {
      expect(r.suggestedMonthly).toBeCloseTo(r.deltaMonthly, 5);
    }
  });

  it("unreachable when suggested > 10x current contribution", () => {
    // gap so huge that delta > 10 * 1000 = 10000
    const r = recommend({ ...BASE, goal: 50_000_000, projectedFinalPatrimony: 600_000 });
    expect(r.state).toBe("unreachable");
  });

  it("unreachable via R$ 50k absolute cap when current=0", () => {
    const r = recommend({
      ...BASE,
      currentMonthlyContribution: 0,
      goal: 50_000_000,
      projectedFinalPatrimony: 200_000,
    });
    expect(r.state).toBe("unreachable");
  });

  it("IPCA-indexed: real-rate differs from nominal-rate suggestion", () => {
    const nominal = recommend({ ...BASE, contributionInflationIndexed: false });
    const indexed = recommend({ ...BASE, contributionInflationIndexed: true });
    expect(nominal.state).toBe("below");
    expect(indexed.state).toBe("below");
    if (nominal.state === "below" && indexed.state === "below") {
      // Real rate < nominal rate → need larger contribution to hit the same goal
      expect(indexed.suggestedMonthly).toBeGreaterThan(nominal.suggestedMonthly);
    }
  });

  it("zero yield falls back to linear annuity", () => {
    const r = recommend({ ...BASE, totalReturnAnnualNet: 0 });
    expect(r.state).toBe("below");
    if (r.state === "below") {
      // gap = 1_000_000 - 600_000 = 400_000 over 120 months
      const expectedDelta = 400_000 / 120;
      expect(r.deltaMonthly).toBeCloseTo(expectedDelta, 2);
    }
  });

  it("horizon=0 with gap > 0 returns unreachable", () => {
    const r = recommend({ ...BASE, horizonYears: 0 });
    expect(r.state).toBe("unreachable");
  });

  it("horizon=0 with no gap returns already-on-track", () => {
    const r = recommend({ ...BASE, horizonYears: 0, projectedFinalPatrimony: 1_000_000 });
    expect(r.state).toBe("already-on-track");
  });
});

describe("goalProbability", () => {
  it("returns 0 for empty distribution", () => {
    expect(goalProbability([], 1_000_000)).toBe(0);
  });

  it("returns fraction of values >= goal", () => {
    const dist = [500_000, 800_000, 1_000_000, 1_200_000, 1_500_000];
    // 3 of 5 are >= 1_000_000
    expect(goalProbability(dist, 1_000_000)).toBeCloseTo(0.6);
  });

  it("returns 1 when all values clear the goal", () => {
    expect(goalProbability([1, 2, 3], 0)).toBe(1);
  });

  it("returns 0 when no value clears the goal", () => {
    expect(goalProbability([1, 2, 3], 100)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run tests/goal-recommend.test.ts`
Expected: FAIL with "Cannot find module '@/lib/goal-recommend'" or similar.

- [ ] **Step 3: Write the implementation**

Create `web/lib/goal-recommend.ts`:

```ts
/**
 * Pure recommender for the GoalCard. Closed-form FV math; no React, no I/O.
 *
 * Strategy:
 *   1. If capital already clears the goal → already-met (nothing to recommend).
 *   2. If the simulate engine's projectedFinal already clears the goal → already-on-track.
 *   3. Otherwise compute the additional monthly contribution that closes the gap
 *      using an ordinary annuity FV formula. If the result requires a 10x jump in
 *      the user's current contribution (or > R$ 50k absolute when current=0),
 *      flag as unreachable.
 *
 * The "rate" fed into FV is the portfolio's blended total return (yield net of
 * tax + capital gain). When the user opts to index contributions to IPCA, we
 * use the real rate (nominal discounted by expected inflation) so the math is
 * consistent with the backend simulate engine.
 */

export type RecommendInputs = {
  goal: number;
  capital: number;
  horizonYears: number;
  currentMonthlyContribution: number;
  contributionInflationIndexed: boolean;
  totalReturnAnnualNet: number;
  projectedFinalPatrimony: number;
  expectedInflation: number;
};

export type Recommendation =
  | { state: "already-met" }
  | { state: "already-on-track"; projectedFinal: number }
  | { state: "below"; suggestedMonthly: number; deltaMonthly: number }
  | { state: "unreachable"; suggestedMonthly: number };

const UNREACHABLE_MULTIPLIER = 10;
const UNREACHABLE_ABSOLUTE_CAP_BRL = 50_000;

export function recommend(i: RecommendInputs): Recommendation {
  if (i.capital >= i.goal) return { state: "already-met" };
  if (i.projectedFinalPatrimony >= i.goal) {
    return { state: "already-on-track", projectedFinal: i.projectedFinalPatrimony };
  }

  const gap = i.goal - i.projectedFinalPatrimony;
  const n_m = i.horizonYears * 12;

  if (n_m === 0) {
    return { state: "unreachable", suggestedMonthly: i.currentMonthlyContribution };
  }

  const r_annual = i.contributionInflationIndexed
    ? (1 + i.totalReturnAnnualNet) / (1 + i.expectedInflation) - 1
    : i.totalReturnAnnualNet;
  const r_m = Math.pow(1 + r_annual, 1 / 12) - 1;

  const delta_c =
    Math.abs(r_m) < 1e-9
      ? gap / n_m
      : (gap * r_m) / (Math.pow(1 + r_m, n_m) - 1);

  const suggested = i.currentMonthlyContribution + delta_c;

  const cap = Math.max(
    i.currentMonthlyContribution * UNREACHABLE_MULTIPLIER,
    UNREACHABLE_ABSOLUTE_CAP_BRL,
  );
  if (suggested > cap) {
    return { state: "unreachable", suggestedMonthly: suggested };
  }

  return { state: "below", suggestedMonthly: suggested, deltaMonthly: delta_c };
}

export function goalProbability(finalDistribution: readonly number[], goal: number): number {
  if (finalDistribution.length === 0) return 0;
  let hit = 0;
  for (const v of finalDistribution) if (v >= goal) hit++;
  return hit / finalDistribution.length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run tests/goal-recommend.test.ts`
Expected: PASS, 14 tests passing (10 for `recommend` + 4 for `goalProbability`).

- [ ] **Step 5: Run typecheck to verify no TS errors**

Run: `cd web && npx tsc --noEmit`
Expected: no errors output.

- [ ] **Step 6: Commit**

```bash
git add web/lib/goal-recommend.ts web/tests/goal-recommend.test.ts
git commit -m "feat(goal): add pure recommender module (FV closed-form + MC probability)"
```

---

## Task 2: Wire `GoalCard` to use the recommender

**Files:**
- Modify: `web/components/visao-geral/GoalCard.tsx`

This task replaces the hardcoded "R$ 800/mês → 91% provável" block with state-driven rendering, fixes the misleading "% provável" label on the progress bar, and adds a real probability badge from Monte Carlo. The Apply button gets a real onClick handler.

- [ ] **Step 1: Inspect the current `GoalCard.tsx` to know what to preserve**

Run: `cat web/components/visao-geral/GoalCard.tsx`
Note: the editable goal target (input mode, Enter/Esc handling, button hover behavior) stays intact. We only touch the bottom recommendation block and the progress bar label.

- [ ] **Step 2: Replace `GoalCard.tsx` with the new version**

Write to `web/components/visao-geral/GoalCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { useSimulate, useMonteCarlo, useMacro } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRs, formatPercent } from "@/lib/format";
import { totalReturn } from "@/lib/carteira-derive";
import { recommend, goalProbability } from "@/lib/goal-recommend";

export function GoalCard() {
  const sim = useSimulate();
  const mc = useMonteCarlo();
  const macro = useMacro();
  const goal = useScenarioStore((s) => s.goalTarget);
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const setGoalTarget = useScenarioStore((s) => s.setGoalTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoalTarget(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (sim.isLoading) return <ChartSkeleton height={420} />;
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const pf = sim.data!.portfolio;
  const current = pf.patrimony[pf.patrimony.length - 1];
  const today = pf.patrimony[0];
  const progress = Math.min(today / goal, 1);

  const rec = recommend({
    goal,
    capital: today,
    horizonYears: scenario.horizon,
    currentMonthlyContribution: scenario.portfolio.monthlyContribution,
    contributionInflationIndexed: scenario.portfolio.contributionInflationIndexed,
    totalReturnAnnualNet: totalReturn(scenario.portfolio),
    projectedFinalPatrimony: current,
    expectedInflation: macro.data?.ipca ?? 0.04,
  });

  const mcDist = mc.data?.portfolio.finalDistribution ?? [];
  const mcReady = !mc.isLoading && !mc.error && mcDist.length > 0;
  const probability = mcReady ? goalProbability(mcDist, goal) : null;

  const probabilityColor =
    probability === null
      ? "text-ink-3"
      : probability >= 0.7
        ? "text-brand-bright"
        : probability >= 0.4
          ? "text-accent-amber"
          : "text-accent-coral";

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5 flex flex-col h-[420px]">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-brand-bright" />
        <h3 className="text-[13.5px] font-semibold text-ink">Meta patrimonial</h3>
      </div>
      {editing ? (
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          aria-label="Editar meta"
          className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2 py-0.5"
        />
      ) : (
        <button
          type="button"
          aria-label="Editar meta"
          onClick={() => {
            setDraft(String(goal));
            setEditing(true);
          }}
          className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright text-left"
        >
          {formatRs(goal)}
        </button>
      )}
      <p className="text-[12px] text-ink-3 mt-1">Hoje · {formatRs(today)}</p>

      <div className="mt-4">
        <div className="h-2 bg-bg-3 rounded-pill overflow-hidden">
          <div
            className="h-full rounded-pill transition-all"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #2af0c4 0%, #00b894 100%)",
            }}
          />
        </div>
        <p className="text-[11.5px] text-ink-3 mt-1">{formatPercent(progress)} da meta alocada</p>
        {probability !== null && (
          <p className={`text-[11.5px] mt-0.5 ${probabilityColor}`}>
            {formatPercent(probability)} provável de atingir em {scenario.horizon}a
          </p>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-line-soft">
        <p className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Recomendação investa AI</p>
        <RecommendationBlock
          rec={rec}
          horizonYears={scenario.horizon}
          currentMonthly={scenario.portfolio.monthlyContribution}
          ipcaIndexed={scenario.portfolio.contributionInflationIndexed}
          onApply={(suggested) => {
            setScenario({
              ...scenario,
              portfolio: { ...scenario.portfolio, monthlyContribution: suggested },
            });
          }}
        />
      </div>
    </div>
  );
}

type RecBlockProps = {
  rec: ReturnType<typeof recommend>;
  horizonYears: number;
  currentMonthly: number;
  ipcaIndexed: boolean;
  onApply: (suggested: number) => void;
};

function RecommendationBlock({ rec, horizonYears, currentMonthly, ipcaIndexed, onApply }: RecBlockProps) {
  if (rec.state === "already-met") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          🎉 Meta atingida. Considere revisar para um valor mais ambicioso.
        </p>
      </div>
    );
  }
  if (rec.state === "already-on-track") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Aporte atual (<span className="text-ink font-semibold">{formatRs(currentMonthly)}/mês</span>) já é suficiente — projeção <span className="text-ink font-semibold">{formatRs(rec.projectedFinal)}</span> em {horizonYears}a.
        </p>
      </div>
    );
  }
  if (rec.state === "unreachable") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Meta improvável mesmo com aporte &gt; <span className="text-ink font-semibold">{formatRs(rec.suggestedMonthly)}/mês</span> — considere aumentar horizonte ou reduzir alvo.
        </p>
      </div>
    );
  }
  const applied = Math.abs(currentMonthly - rec.suggestedMonthly) < 1;
  return (
    <>
      <div className="bg-bg-3 rounded-card p-3 mb-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Aporte de <span className="text-ink font-semibold">{formatRs(rec.suggestedMonthly)}/mês</span>{ipcaIndexed ? " indexado ao IPCA" : ""} para atingir a meta em {horizonYears}a.
        </p>
      </div>
      <button
        type="button"
        disabled={applied}
        onClick={() => onApply(rec.suggestedMonthly)}
        className="w-full text-[13px] font-semibold py-2 rounded-[10px] text-bg-0 shadow-glow hover:scale-[1.01] transition-transform disabled:opacity-60 disabled:hover:scale-100"
        style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
      >
        {applied ? "Sugestão aplicada ✓" : "Aplicar sugestão"}
      </button>
    </>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the new module tests once more to confirm no breakage**

Run: `cd web && npx vitest run tests/goal-recommend.test.ts`
Expected: 14 tests passing.

- [ ] **Step 5: Do NOT commit yet** — the existing `goal-card.test.tsx` will fail because we now call `useMonteCarlo` and `useMacro`, which aren't mocked. Task 3 fixes that, and Task 3's commit will batch both changes.

---

## Task 3: Update `goal-card.test.tsx` mocks + add state coverage

**Files:**
- Modify: `web/tests/goal-card.test.tsx`

The existing 5 tests for the editable goal target stay. They need updated mocks because `GoalCard` now also reads `useMonteCarlo` and `useMacro`. We add 5 new tests covering each recommendation state and the Apply button.

- [ ] **Step 1: Replace `web/tests/goal-card.test.tsx` with the new version**

Write to `web/tests/goal-card.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalCard } from "@/components/visao-geral/GoalCard";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_GOAL } from "@/lib/defaults";
import type { SimulateOut, SimulateMonteCarloOut, MacroOut } from "@/lib/api-types";

let simPatrimony: number[] = [230_000, 250_000];
let mcDist: number[] = [];

function makeSim(patrimony: number[]): SimulateOut {
  return {
    realEstate: { label: "RE", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 12], cumulativeIncome: [0, 12] },
    portfolio: { label: "PF", color: "#fff", years: [0, 1], patrimony, annualIncome: [0, 5_000], cumulativeIncome: [0, 5_000] },
    benchmark: { label: "BM", color: "#fff", years: [0, 1], patrimony: [100, 110], annualIncome: [0, 0], cumulativeIncome: [0, 0] },
    sensitivity: [],
    taxComparison: [],
  };
}

function makeMc(distribution: number[]): SimulateMonteCarloOut {
  const mkResult = (d: number[]) => ({
    label: "PF",
    color: "#fff",
    p10: [], p50: [], p90: [],
    finalDistribution: d,
    maxDrawdowns: [],
  });
  return { realEstate: mkResult([]), portfolio: mkResult(distribution) };
}

const fakeMacro: MacroOut = {
  selic: 0.12, cdi: 0.12, ipca: 0.04, usdBrl: 5,
  isStale: false, sourceLabel: "test",
};

vi.mock("@/lib/api", () => ({
  useSimulate: () => ({ data: makeSim(simPatrimony), isLoading: false, error: null, refetch: vi.fn() }),
  useMonteCarlo: () => ({ data: makeMc(mcDist), isLoading: false, error: null, refetch: vi.fn() }),
  useMacro: () => ({ data: fakeMacro, isLoading: false, error: null, refetch: vi.fn() }),
}));

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe("GoalCard editable target", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
    simPatrimony = [230_000, 250_000];
    mcDist = [];
  });

  it("renders the goal as a button by default (not in edit mode)", () => {
    render(wrap(<GoalCard />));
    expect(screen.getByRole("button", { name: /editar meta/i })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });

  it("clicking the goal switches to input mode with the current value pre-filled", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe(String(DEFAULT_GOAL));
  });

  it("pressing Enter with a valid positive number commits and exits edit mode", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "800000");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(800_000);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/800/);
  });

  it("pressing Esc cancels without calling setGoalTarget", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "999999");
    await user.keyboard("{Escape}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar meta/i }).textContent).toMatch(/600/);
  });

  it("submitting empty/zero/negative reverts silently without changing the store", async () => {
    const user = userEvent.setup();
    render(wrap(<GoalCard />));

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "0");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);

    await user.click(screen.getByRole("button", { name: /editar meta/i }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "-100");
    await user.keyboard("{Enter}");
    expect(useScenarioStore.getState().goalTarget).toBe(DEFAULT_GOAL);
  });
});

describe("GoalCard recommendation states", () => {
  beforeEach(() => {
    useScenarioStore.setState({ goalTarget: DEFAULT_GOAL });
    simPatrimony = [230_000, 250_000];
    mcDist = [];
  });

  it("renders 'Meta atingida' when capital >= goal", () => {
    useScenarioStore.setState({ goalTarget: 100_000 });
    simPatrimony = [230_000, 250_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/Meta atingida/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("renders 'Aporte atual já é suficiente' when projectedFinal >= goal", () => {
    useScenarioStore.setState({ goalTarget: 240_000 });
    simPatrimony = [230_000, 250_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/já é suficiente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("renders 'Aporte de R$ X/mês' + apply button for below state", () => {
    useScenarioStore.setState({ goalTarget: 600_000 });
    simPatrimony = [230_000, 300_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/Aporte de R\$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aplicar sugest/i })).toBeInTheDocument();
  });

  it("renders 'Meta improvável' for unreachable state (no apply button)", () => {
    useScenarioStore.setState({ goalTarget: 50_000_000 });
    simPatrimony = [230_000, 300_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/improv[áa]vel/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar sugest/i })).not.toBeInTheDocument();
  });

  it("clicking Apply updates scenario.portfolio.monthlyContribution", async () => {
    const user = userEvent.setup();
    useScenarioStore.setState({ goalTarget: 600_000 });
    simPatrimony = [230_000, 300_000];
    const before = useScenarioStore.getState().scenario.portfolio.monthlyContribution;
    render(wrap(<GoalCard />));
    await user.click(screen.getByRole("button", { name: /aplicar sugest/i }));
    const after = useScenarioStore.getState().scenario.portfolio.monthlyContribution;
    expect(after).toBeGreaterThan(before);
  });

  it("probability badge shows percentage from MC finalDistribution", () => {
    useScenarioStore.setState({ goalTarget: 500_000 });
    simPatrimony = [230_000, 300_000];
    // 7 of 10 trajectories clear the 500k goal → 70%
    mcDist = [100_000, 200_000, 300_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_100_000];
    render(wrap(<GoalCard />));
    expect(screen.getByText(/70%.*prov[áa]vel/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the goal-card tests**

Run: `cd web && npx vitest run tests/goal-card.test.tsx`
Expected: PASS, 11 tests (5 existing + 6 new).

- [ ] **Step 3: Run the full vitest suite to ensure no regression elsewhere**

Run: `cd web && npx vitest run`
Expected: all suites pass. Baseline before this PR is 433 tests; new total should be approximately 433 + 14 (goal-recommend) + 6 (new goal-card cases) = 453.

- [ ] **Step 4: Run typecheck + lint**

Run: `cd web && npx tsc --noEmit && npx eslint components/visao-geral/GoalCard.tsx lib/goal-recommend.ts tests/goal-recommend.test.ts tests/goal-card.test.tsx`
Expected: no errors.

- [ ] **Step 5: Run `next build` to catch Vercel-style strictness**

Run: `cd web && npx next build`
Expected: build succeeds without TS errors. Watch especially for unused-import warnings or strict type errors that local tsc accepts but Next rejects.

- [ ] **Step 6: Commit (batches Tasks 2 and 3 since the component change required new test mocks)**

```bash
git add web/components/visao-geral/GoalCard.tsx web/tests/goal-card.test.tsx
git commit -m "feat(goal): real recommender + MC probability in GoalCard

State machine de 4 estados (already-met / already-on-track / below /
unreachable). Substitui o texto hardcoded 'R\$ 800/mês → 91%' por
sugestão real via FV closed-form. Badge '% provável' agora vem do
Monte Carlo finalDistribution (antes era current/goal mislabeled).
Botão 'Aplicar sugestão' muta scenario.portfolio.monthlyContribution.

Refs: docs/superpowers/specs/2026-05-13-goal-recommender-design.md"
```

---

## Task 4: Manual smoke + roadmap update + production deploy

**Files:**
- Modify: `docs/superpowers/FUTURE_IMPROVEMENTS.md`

- [ ] **Step 1: Run `next dev` and manually verify the four states**

Run: `cd web && npx next dev`
Open `http://localhost:3000`.

Manually validate (record observations as you go):
1. Default state → expect "below" (goal R$ 600k, current ~R$ 230k, projected < goal). Apply button visible.
2. Click "Aplicar sugestão". Form should update `monthlyContribution` (verify by opening the scenario drawer if available, or watching the dashboard recompute). Button flips to "Sugestão aplicada ✓" + disabled.
3. Click the goal value, edit it to R$ 100k, press Enter → state flips to `already-met`, "🎉 Meta atingida" appears, no button.
4. Edit goal to R$ 50M → state flips to `unreachable`, "Meta improvável" appears, no button.
5. Probability badge color: ≥70% green, 40-70% amber, <40% coral.

If any of these fail visually, fix before continuing.

- [ ] **Step 2: Update roadmap to mark recommender as shipped**

Open `docs/superpowers/FUTURE_IMPROVEMENTS.md`. Find the `### Real recommendation engine` entry under `## Goal Card`. Append `— ✅ shipped 2026-05-13` to the heading and add a one-line summary of what shipped (frontend FV + MC probability, no backend changes).

- [ ] **Step 3: Commit the roadmap update**

```bash
git add docs/superpowers/FUTURE_IMPROVEMENTS.md
git commit -m "docs(roadmap): mark real recommendation engine as shipped"
```

- [ ] **Step 4: Push to main**

We're already on `main` since this branch follows the established flow (commits go directly on main and ship). Confirm:

```bash
git status   # expect: On branch main, working tree clean
git log --oneline -5
git push origin main
```

- [ ] **Step 5: Smoke prod after Vercel rebuild (~3-5 min)**

Wait for Vercel build to finish (you can watch with `gh` if installed, otherwise just wait ~5min), then:

```bash
curl -sL -o /dev/null -w "%{http_code}\n" https://investa-beta.vercel.app/
curl -sL https://investa-beta.vercel.app/_next/static/chunks/main-app-*.js | head -c 200
```

Open https://investa-beta.vercel.app in the browser and confirm:
- GoalCard renders without errors
- Probability badge appears below the progress bar
- Apply button (if "below" state) responds to clicks

If smoke fails, investigate before claiming the work done.

---

## Self-review (run after writing the plan, before handoff)

Each spec section has at least one task:
- "Recommendation module" → Task 1 ✓
- "GoalCard rendering / state machine" → Task 2 ✓
- "Apply button behavior" → Task 2 (`onApply`) + Task 3 (test) ✓
- "Error handling: monte-carlo errored" → Task 2 (mcReady guard, badge hidden via `probability !== null`) ✓
- "Testing — goal-recommend.test.ts" → Task 1 ✓
- "Testing — goal-card.test.tsx" → Task 3 ✓
- "Verification before merge" → Task 3 (tsc + vitest + next build) + Task 4 (manual smoke) ✓

Type consistency check:
- `recommend()` returns the `Recommendation` discriminated union; `GoalCard` narrows via `rec.state === "..."` ✓
- `goalProbability()` returns `number` (or `0` if empty); `GoalCard` handles `mcReady === false` separately ✓
- `setScenario` signature matches `(scenario: SimulateInput) => void` (already in store) ✓

Placeholder scan: no TBDs, no "implement later", every step has full code or full command.
