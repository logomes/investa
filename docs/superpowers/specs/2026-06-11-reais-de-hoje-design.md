# Reais de Hoje (projeção deflacionada pelo IPCA) — Design

**Date:** 2026-06-11
**Status:** Implemented
**Owner:** lucgomes

## Context

Round 2 of the approved innovation roadmap (see `2026-06-11-portfolio-bridge-design.md`
for the market research): ① ponte+solver (shipped, PR #2) → **② reais de hoje** →
③ tributação forward → ④ copiloto IA. Branch `feat/reais-de-hoje`, stacked on
`feat/portfolio-bridge`.

BR trackers show nominal returns vs CDI; US planners assume US inflation. Showing
patrimônio in "reais de hoje" with an explicit real-rate decomposition is differentiating
and pedagogically powerful — in real terms, an IPCA+6% benchmark yields exactly 6%.

## Problem

Every projection surface (Visão Geral's 5 cards, Risco's 4, Sensibilidade, Exportar)
renders NOMINAL values. A R$ 2M projection in 10 years reads as wealth; deflated at 4.5%
IPCA it's R$ 1.29M of today's purchasing power. The user can't see that, and inflation
is not even a parameter they control — the backend silently uses the server's macro IPCA
for contribution indexing.

## Decisions (user-approved)

| Topic | Decision |
|---|---|
| Mode behavior | **Global toggle, default REAL** ("R$ de hoje"), persisted |
| Deflator | **Scenario parameter `expectedInflation`**, prefilled from BCB macro, editable in the drawer — single source for aportes indexados AND deflation |
| Extra scope | Decomposition as KPI/text **and** as chart (inflation-loss area on EvolutionCard) |
| Out (deferred) | Deflating `/historico` past snapshots (needs historical IPCA series from BCB — future round) |
| Approach | A — frontend display-layer deflation; backend only gains the inflation parameter |

## Out of scope

- `/historico` (past snapshots; different deflator — realized IPCA, not projected).
- Real-rate inputs (user keeps entering nominal yields; only display changes).
- Per-chart toggles (one global mode).
- Backend dual nominal+real payloads (client divides in one line; rejected).

---

## 1. Inflation as a scenario parameter

**Backend** (`api/`):
- `SimulateInput` gains `expected_inflation: float | None = Field(default=None, ge=0, le=0.5)`.
  `GoalSolveInput` gains the same field.
- `routers/simulation.py`: everywhere `macro.ipca` feeds a simulation today
  (`simulate_portfolio`, `simulate_portfolio_mc`, `simulate_benchmark`,
  `sensitivity_portfolio`, `solve_goal_contribution`), use
  `payload.expected_inflation if payload.expected_inflation is not None else macro.ipca`
  — one local helper `_resolve_ipca(payload, macro)`. `None` fallback keeps old clients
  (and the deployed pair mid-rollout) working unchanged.

**Frontend**:
- `SimulateInput.expectedInflation: number` (required in TS; `DEFAULT_SCENARIO` ships
  `0.045` as placeholder), `GoalSolveInput.expectedInflation: number`.
- Drawer `CapitalSection` (global scenario params) gains "Inflação projetada (IPCA)"
  number input (`step="any"`), prefilled by `DEFAULT_SCENARIO`; a small caption shows the
  live BCB value ("BCB hoje: 4,5%") via `useMacro` WITHOUT auto-overwriting the field
  (scenario stability > freshness; the user updates deliberately).
- Store migration **v5 → v6**: persisted scenarios lacking `expectedInflation` get
  `DEFAULT_SCENARIO.expectedInflation` injected (the persisted scenario object replaces
  the default wholesale, so zustand's shallow merge does NOT cover nested fields — a
  real migrate step is required, unlike `lastRealImportAt`).
- `GoalCard`'s `recommend(...)` and `handleSolve` switch their inflation input from
  `macro.data?.ipca ?? 0.04` to `scenario.expectedInflation` (single source).
- `useGoalSolve` payload includes `expectedInflation`.

## 2. Global display mode

**Store** (`web/lib/store.ts`): `displayMode: "real" | "nominal"`, initial `"real"`,
setter `setDisplayMode`, included in `partialize`. Top-level field → zustand shallow
merge covers old payloads (same pattern as `lastRealImportAt`); no version bump for this
field (v6 bump comes from §1 regardless).

**Topbar**: compact segmented toggle `R$ de hoje | Nominal` (two pill buttons,
`TimelineFilter` idiom) right of the subtitle block; hidden below `md` (pages still
respect the persisted mode).

**`web/lib/deflate.ts`** (new, pure):

```ts
export function deflationFactor(ipca: number, years: number): number;   // (1+ipca)^-years
export function deflateAt(value: number, ipca: number, years: number): number;
export function deflateSeries(values: readonly number[], ipca: number): number[]; // index = year
```

**Surfaces respecting the mode** (each reads `displayMode` + `scenario.expectedInflation`
and applies `deflate*` at the render edge when mode is `"real"`):

| Surface | What deflates |
|---|---|
| EvolutionCard | portfolio/benchmark patrimony series, MC band (p10/p90 per-year), monthly view (deflate annual values BEFORE geometric interpolation) |
| MonthlyIncomeCard | annualIncome/12 per year |
| ComparativoTable | final patrimony, renda/mês (yield ratio is unit-free — unchanged) |
| KpiRow (Visão Geral) | patrimônio projetado, renda mensal final; CAGR becomes real CAGR |
| GoalCard | see §3 |
| Risco: MCBandCard | p50/p10/p90 per-year + benchmark line |
| Risco: DistributionCard / Histogram | finalDistribution × `deflationFactor(ipca, horizon)` (single scalar) |
| Risco: KpiRowRisco | p50/p10/benchmarkFinal (drawdown % is unit-free — unchanged) |
| Sensibilidade | tornado pessimistic/optimistic + base KPI × horizon factor |
| Exportar | CSV rows in the active mode; `csvFilename` gains `_reais-de-hoje` suffix in real mode; preview header shows the mode |

Mode badge: cards that deflate add a small "R$ de hoje" chip next to their title (one
shared `DisplayModeBadge` component) so a screenshot is never ambiguous.

## 3. Goal semantics

The goal is compared **in the active mode's space**:
- Real mode: `goalProbability(deflatedDistribution, goal)` — i.e. distribution ×
  `deflationFactor(ipca, horizon)`; progress bar and KPI "Probabilidade de meta"
  likewise. "R$ 600k de hoje" is a harder target than "R$ 600k nominais" — the
  probability shift between modes is honest and expected.
- Nominal mode: current behavior, untouched.
- The MC solver (`/api/goal/solve`) targets a NOMINAL goal; in real mode the GoalCard
  converts before calling: `goalTarget = goal / deflationFactor(ipca, horizon)`
  (inflate today's-money goal to its nominal equivalent). FV `recommend` gets the same
  treatment.

## 4. Decomposition

- **KPI** (Visão Geral, real mode only): "Patrimônio projetado" sub becomes
  "nominal {R$ Y} · inflação consome {R$ Y−X}"; delta chip shows real CAGR with
  "(nominal {x}%)" alongside.
- **Chart** (EvolutionCard, real mode only): portfolio REAL curve rendered solid; a
  translucent band fills between the real and nominal portfolio curves, legend
  "Inflação (perda de poder de compra)". Reuses the existing LineChart `bands` mechanism
  (lower = real series, upper = nominal series); the MC band stays, both visible.

## 5. Failure modes

- `expectedInflation = 0` → factor 1, real ≡ nominal everywhere (no special-casing).
- Old persisted scenario → v6 migration injects the default; old API clients → `None`
  fallback to server macro.
- Drawer zod: `expectedInflation: z.number().min(0).max(0.5)`.

## 6. Testing

- `deflate.test.ts`: factor/series/at, ipca=0 identity, index-as-year convention.
- Store: v6 migration injects `expectedInflation` into v5 payloads; preserves the rest;
  `displayMode` defaults real and persists.
- Cards: EvolutionCard/KpiRow/Risco/Sensibilidade render both modes (fixture math
  asserted, e.g. 1000 @ ipca 10% year 2 → 826.45); GoalCard probability differs between
  modes; badge presence.
- API: `expected_inflation` honored (simulate with 0 vs 0.10 changes indexed
  contributions), `None` falls back to macro; goal/solve same.
- e2e: toggle in Topbar flips EvolutionCard values; drawer field edits inflation.

## Risks

- **Touch surface is wide** (12 components) — mitigated by the pure helper + per-card
  tests + the badge making mode visible.
- **Probability shift surprises** (P(meta) drops in real mode) — mitigated by honest
  labeling ("meta em R$ de hoje") in GoalCard copy.
- **Stacked branch depth** (main ← #1 ← #2 ← this) — merge train must land in order;
  no rebase amend games, just sequential merges.
