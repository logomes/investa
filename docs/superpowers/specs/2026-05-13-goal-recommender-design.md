# Goal Recommender — Design

**Date:** 2026-05-13
**Status:** Approved
**Owner:** lucgomes

## Problem

`GoalCard` displays two pieces of advice that are not derived from any model:

1. The progress bar label says "X% provável" but the underlying math is `current / goal` — that's an *allocation ratio*, not a probability of reaching the goal.
2. The "Recomendação investa AI" block is fully hardcoded: every user sees the same `R$ 800/mês → 91%` text, and the "Aplicar sugestão" button is a no-op.

Replace both with real logic driven by the scenario, simulate output, and Monte Carlo distribution.

## Solution (TL;DR)

- New pure module `web/lib/goal-recommend.ts` computes the suggested monthly contribution from a closed-form future-value (FV) equation, using the user's projected final patrimony (from `useSimulate`) as the baseline.
- `GoalCard` reads the recommendation, plus the Monte Carlo `finalDistribution`, and renders one of four states (already-met / already-on-track / below / unreachable).
- "Aplicar sugestão" mutates `scenario.portfolio.monthlyContribution` via the existing store. React Query refetches `simulate` and `monte-carlo` automatically.

## Out of scope

- Backend endpoint for the calculation. The math is a closed-form equation; doing it client-side avoids a roundtrip and keeps the recommendation in lockstep with the existing `simulate` output the user already sees.
- Binary-search-over-Monte-Carlo to hit a target probability (e.g., 90%). Considered, rejected — adds latency and a second hyperparameter the user has to understand. Tracked as a follow-up in `FUTURE_IMPROVEMENTS.md`.
- Changes to the `simulate` or `monte-carlo` backend endpoints.
- Editing `goalTarget` (already shipped, see `2026-05-07-editable-goal-target-design.md`).

## Architecture

```
useSimulate()  ─┐
useMonteCarlo()─┼─→  GoalCard
useScenarioStore┘        │
                          ├─→ recommend({...}) ─→ Recommendation
                          └─→ goalProbability(finalDistribution, goal) ─→ number
                                  │
                                  ▼
                            renders state-dependent text + apply button
                                  │
                            click "Aplicar"
                                  ▼
                          setScenario({...portfolio: {monthlyContribution: suggested}})
                                  ▼
                          React Query refetches simulate + MC
```

New files: `web/lib/goal-recommend.ts`, `web/tests/goal-recommend.test.ts`.
Modified files: `web/components/visao-geral/GoalCard.tsx`, `web/tests/goal-card.test.tsx` (if it exists; otherwise new).

No backend changes. No schema changes. No store changes (`setScenario` already exists).

## Recommendation module

### Signature

```ts
export type RecommendInputs = {
  goal: number;
  capital: number;                       // current patrimony BRL (today)
  horizonYears: number;
  currentMonthlyContribution: number;
  contributionInflationIndexed: boolean;
  blendedYieldAnnualNet: number;         // from carteira-derive weightedYieldNet
  projectedFinalPatrimony: number;       // simulate.portfolio.patrimony[last]
  expectedInflation: number;             // macro.ipca (decimal e.g. 0.04)
};

export type Recommendation =
  | { state: "already-met" }
  | { state: "already-on-track"; projectedFinal: number }
  | { state: "below"; suggestedMonthly: number; deltaMonthly: number }
  | { state: "unreachable"; suggestedMonthly: number };

export function recommend(i: RecommendInputs): Recommendation;
```

### Algorithm

1. **`already-met`** if `capital >= goal`. No further work.
2. **`already-on-track`** if `projectedFinalPatrimony >= goal`. The user's current scenario already reaches the goal — no extra aporte needed.
3. Otherwise, compute the additional monthly contribution `delta_c` that closes the gap using an ordinary annuity FV formula:
   - `r = contributionInflationIndexed ? (1 + blendedYieldAnnualNet) / (1 + expectedInflation) - 1 : blendedYieldAnnualNet`
   - `r_m = (1 + r)^(1/12) - 1`
   - `n_m = horizonYears * 12`
   - If `r_m ≈ 0` (|r_m| < 1e-9): `delta_c = (goal - projectedFinal) / n_m` (linear fallback to avoid div-by-zero)
   - Else: `delta_c = (goal - projectedFinal) * r_m / ((1 + r_m)^n_m - 1)`
4. `suggestedMonthly = currentMonthlyContribution + delta_c`
5. **`unreachable`** if `suggestedMonthly > max(currentMonthlyContribution * 10, 50000)`. Threshold chosen because (a) a 10× jump signals the user's plan doesn't fit their lifestyle, (b) the absolute cap of R$ 50k/month catches the `current = 0` case where the multiplier is meaningless. Both thresholds are constants in the module (not config) — explicit > flexible.
6. Otherwise return **`below`** with `suggestedMonthly` and `deltaMonthly`.

### Why use `projectedFinalPatrimony` instead of recomputing FV from scratch

The `simulate` engine already computes the deterministic trajectory accounting for `capital`, `monthlyContribution`, the per-asset yields, tax drag, and reinvestment toggle. We treat that final value as the source of truth — our recommendation only needs to compute the **delta** in contribution. This keeps the recommendation consistent with what the user sees in the rest of the dashboard.

The `blendedYieldAnnualNet` we use for the delta annuity is the same value `carteira-derive#weightedYieldNet` computes, ensuring internal consistency.

## GoalCard rendering

### Top half (unchanged in layout, label corrected)

- Progress bar still shows `current / goal`. **Label changes from "X% provável" → "X% da meta alocada"**, fixing the semantic bug.
- New badge below the bar: **"Y% provável de atingir em {horizon}a"**, where Y is computed by:
  ```ts
  function goalProbability(finalDistribution: number[], goal: number): number {
    if (finalDistribution.length === 0) return 0;
    return finalDistribution.filter((v) => v >= goal).length / finalDistribution.length;
  }
  ```
  Color: `≥0.7` green, `0.4–0.7` amber, `<0.4` coral.

### Recommendation block (state machine)

| State | Text | Button |
|-------|------|--------|
| `already-met` | "🎉 Meta atingida. Considere revisar para um valor mais ambicioso." | hidden |
| `already-on-track` | "Aporte atual (R$ {current}/mês) já é suficiente — projeção R$ {projectedFinal} em {horizon}a." | hidden |
| `below` | "Aporte de R$ {suggested}/mês{ipca ? ' indexado ao IPCA' : ''} para atingir a meta em {horizon}a." | "Aplicar sugestão" |
| `unreachable` | "Meta improvável mesmo com aporte > R$ {suggested}/mês — considere aumentar horizonte ou reduzir alvo." | hidden |

### "Aplicar sugestão" button behavior

- Only rendered in `below`.
- `onClick`: `setScenario({ ...scenario, portfolio: { ...scenario.portfolio, monthlyContribution: suggestedMonthly } })`.
- "Applied" detection: when `|scenario.portfolio.monthlyContribution - suggestedMonthly| < 1`, label becomes "Sugestão aplicada ✓", button `disabled`. No local state needed — the comparison runs every render.
- After click, React Query keys (which include the scenario via `stableStringify`) change → both `simulate` and `monte-carlo` refetch → all card values update reactively.

## Error handling

- If `simulate` or `monte-carlo` are loading: existing `<ChartSkeleton />` already covers this — no change.
- If `simulate` errored: existing `<ErrorCard />` already covers this — no change.
- If `monte-carlo` errored but `simulate` succeeded: render the recommendation block but skip the probability badge line entirely (don't show "—" — just omit). The recommendation itself is still useful without the MC layer.
- `finalDistribution.length === 0` (MC returned empty): `goalProbability` returns 0; badge shows "0% provável" — acceptable since it surfaces the broken state without crashing.

## Testing

### `web/tests/goal-recommend.test.ts` (pure unit, no React)

- `capital >= goal` → `already-met`
- `projectedFinal >= goal, current > 0` → `already-on-track`
- Classic below: `delta_c > 0`, `suggested = current + delta_c`
- Below with `current = 0`: `suggested = delta_c`
- Unreachable via 10× multiplier: e.g., `current = 500`, suggested would be `> 5000` → `unreachable`
- Unreachable via R$ 50k absolute cap with `current = 0`: huge gap → `unreachable`
- IPCA-indexed: real rate ≠ nominal → suggested differs from non-indexed run with same nominal yield
- Zero yield: `r ≈ 0` → linear annuity fallback (`delta = gap / n_m`)
- Horizon = 0: gap > 0 → `unreachable`; gap = 0 → `already-met`

### `web/tests/goal-card.test.tsx` (component, with mocked hooks)

- Renders "🎉 Meta atingida" for `already-met` scenario
- Renders "Aporte atual já é suficiente" for `already-on-track`
- Renders "Aporte de R$ X/mês" + visible button for `below`
- Renders "Meta improvável" + no button for `unreachable`
- Clicking "Aplicar" calls `setScenario` with the suggested `monthlyContribution`
- Badge MC shows correct percentage from mocked `finalDistribution`
- Button label flips to "Sugestão aplicada ✓" + disabled when `monthlyContribution ≈ suggested`

## Verification before merge

- `npx tsc --noEmit` clean
- `npx vitest run` — all suites pass (current baseline: 433)
- `npx next build` clean
- Manual smoke: edit goal → see recommendation update; click "Aplicar" → see scenario form value update + probability badge change

## Open questions

None — all decisions captured above.
