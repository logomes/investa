# Portfolio Bridge (carteira real → cenário) + Goal Solver — Design

**Date:** 2026-06-11
**Status:** Implemented
**Owner:** lucgomes

## Context: the innovation roadmap this opens

Market research (Jun/2026) showed every BR competitor is tracking/IR-retrospective (Kinvo,
Gorila, Investidor10, Status Invest) and every scenario-first planner is US-centric
(ProjectionLab, Portfolio Visualizer, Empower). The "Brazilian ProjectionLab" intersection
is empty — exactly where investa sits. Four improvement rounds were approved, in order:

1. **Ponte carteira real → cenário + goal solver invertido** ← this spec
2. Projeção em reais de hoje (IPCA-deflated views)
3. Tributação forward dentro da simulação (come-cotas, regressiva, isenções, PGBL/VGBL)
4. Copiloto IA sobre o cenário

## Problem

investa has two halves that don't talk:
- **Real positions**: `/ativos` (B3 import, per-ticker `expectedYield`/`capitalGain`,
  live quotes) + `/renda-fixa` (indexer-based positions) — all in localStorage stores.
- **Scenario**: the drawer's `portfolio` (capital + asset classes with assumptions),
  which feeds `/simulate`, Monte Carlo, sensitivity, tax and goals.

Today the scenario is hand-typed. Making the real portfolio the scenario base with one
click closes a loop no BR tool has (trackers don't project; planners don't track), and
makes rounds 2-4 operate on the user's actual data.

Additionally, the GoalCard's contribution suggestion is a closed-form FV formula; the
deferred "solve for P(meta) ≥ X%" (FUTURE_IMPROVEMENTS.md) becomes much more meaningful
once the scenario reflects the real portfolio.

## Decisions (user-approved)

| Topic | Decision |
|---|---|
| Link semantics | **Snapshot on click** — button overwrites scenario portfolio; free editing afterwards; show "importado em \<data\>" |
| Scope | RV **and** RF in this round |
| Goal solver | **Included**: binary search over Monte Carlo, backend endpoint |
| Approach | Bridge derived in the frontend (data lives in localStorage); solver in the backend (1 request instead of ~8 expensive MC round-trips) |

## Out of scope

- Live link / auto re-derive (rejected in favor of snapshot).
- Open Finance/Pluggy sync (separate FUTURE_IMPROVEMENTS item).
- Per-ticker scenario rows (scenario stays class-level; max 12 assets).
- Configurable confidence UI beyond the 80% default (the API takes `confidence`; the
  UI ships fixed at 0.80 this round).
- Tributação forward (round 3) — the bridge uses today's static class tax rates.

---

## 1. `web/lib/portfolio-bridge.ts` (new, pure)

```ts
export type BridgeResult = {
  portfolio: PortfolioInput;       // capital + assets, weights normalized to Σ=1
  totalBRL: number;
  rvBRL: number;
  rfBRL: number;
  positionsCount: number;          // RV tickers
  rfCount: number;
  skipped: string[];               // tickers/names skipped (e.g. zero value)
};

export function bridgePortfolio(args: {
  positions: readonly AssetPosition[];
  fiPositions: readonly FixedIncomePosition[];
  macro: MacroOut;
  monthlyContribution: number;               // preserved from current scenario
  contributionInflationIndexed: boolean;     // preserved from current scenario
  now?: Date;
}): BridgeResult | null;   // null when both stores are empty
```

**Valuation** (reuse, don't reimplement):
- RV: `assetMarketValueBRL(p, macro)` from `web/lib/patrimony-snapshot.ts`
  (`quantity × (currentPrice ?? avgPrice)`, USD × `macro.usdBrl`).
- RF: `totalCurrentValue(fiPositions, macro, now)` from `web/lib/fi-derive.ts` for the
  total; per-position current value + effective annual rate via the same fi-derive
  helpers (the plan pins exact names after reading fi-derive).

**RV grouping** — by `AssetPosition.assetClass`, mapped 1:1 onto the existing scenario
catalog (`PORTFOLIO_TYPE_BY_ID` in `web/lib/portfolio-asset-types.ts`):

| ativos class | scenario type | taxRate / volatility source |
|---|---|---|
| FII | FII | catalog defaults |
| ACAO_BR_DIVIDENDO | ACAO_BR_DIV | catalog defaults |
| ACAO_BR_CRESCIMENTO | ACAO_BR_CRESC | catalog defaults |
| ETF_BR | ETF_BR | catalog defaults |
| STOCK_US | STOCK_US | catalog defaults |
| REIT_US | REIT_US | catalog defaults |
| ETF_US | ETF_US | catalog defaults |
| BDR | own row "BDRs" | taxRate 0.15, volatility 0.20 (no catalog entry) |

Per class row:
- `weight` = class value ÷ total (final rows re-normalized so Σ=1 ± 0.001 — the drawer's
  zod refine requires it).
- `expectedYield`, `capitalGain` = **value-weighted averages of the per-ticker fields**
  the user already maintains in `/ativos` (not catalog guesses).
- `name` = catalog label; `note` = ticker list, truncated ("HGLG11, XPML11 +3").

**RF grouping** — two rows max:
- `RF_PUBLICO` ("Renda Fixa Tesouro/LCI"): positions with `isTaxExempt === true` OR
  name matching `/tesouro|ntn|td[ -]/i`.
- `RF_PRIVADO` ("Renda Fixa CDB/Debênture"): the rest.
- `expectedYield` = value-weighted effective annual rate (indexer resolved against
  current macro: cdi/selic/ipca + spread, prefixado as-is); `capitalGain` = 0;
  `taxRate`/`volatility` from catalog.

**Constraints & edges**:
- Max rows: 8 RV classes + 2 RF = 10 ≤ `MAX_PORTFOLIO_ASSETS` (12). No truncation needed.
- Both stores empty → `null` (button disabled).
- USD positions present but macro unavailable → the caller never invokes the bridge
  without `macro.data` (button disabled while `useMacro` loading/error).
- Zero-value or non-positive-value entries → collected in `skipped`, excluded from rows.
- `capital` = `totalBRL`; the scenario's top-level `capital` is set to the same value
  (it feeds the benchmark — identical cash basis keeps the comparison fair).
- `monthlyContribution`/`contributionInflationIndexed` pass through unchanged from the
  current scenario (importing positions shouldn't reset the user's aporte plan).

## 2. Drawer UI — `PortfolioSection`

- New button **"Usar carteira real"** at the top of the section, next to the existing
  reset-to-defaults control, following the section's existing button idiom.
- Disabled (with tooltip/caption) when: both stores empty, or macro not loaded.
- Click → inline confirm popover/dialog showing the preview from `BridgeResult`
  (`totalBRL` formatted, rows count, `positionsCount`+`rfCount`, skipped list if any)
  with "Substituir cenário" / "Cancelar". Confirm = `form.setValue` of
  `portfolio.assets`, `portfolio.capital` and top-level `capital` (form-level, so
  Cancelar/Aplicar of the drawer keep their existing semantics).
- After confirm, caption under the button: "Importado da carteira real em DD/MM HH:mm".
  Persisted as `lastRealImportAt: string | null` in the scenario store (new field,
  store version stays 5 — additive field with default null needs no migration; verify
  zustand merge handles it, else bump to v6 trivially).
- Editing anything afterwards does NOT clear the caption (snapshot semantics — the
  caption states provenance, not freshness).

## 3. Backend — `POST /api/goal/solve`

**Input** (`GoalSolveInput`, camelCase like the rest):

```python
class GoalSolveInput(_CamelModel):
    horizon: int = Field(ge=1, le=30)
    portfolio: PortfolioInput
    mc: MonteCarloInput                  # seed/targetPatrimony ignored; nTrajectories capped
    goal_target: float = Field(gt=0)
    confidence: float = Field(default=0.80, ge=0.5, le=0.99)
```

**Output**:

```python
class GoalSolveOut(_CamelModel):
    required_monthly_contribution: float   # R$/month, 0 if already attainable
    achieved_probability: float            # P(final ≥ goal) at the returned contribution
    attainable: bool                       # False if even the upper bound misses confidence
    iterations: int
```

**Algorithm** (`core/models.py :: solve_goal_contribution`):
- Fixed seed (42) so the search is monotone and reproducible across iterations.
- `n_trajectories = min(payload.mc.n_trajectories, 1500)` per iteration (Render free
  budget: ~8 iterations × 1500 ≈ one /simulate-mc call today).
- Probability fn: `P(c) = mean(final_distribution ≥ goal)` via `simulate_portfolio_mc`
  with `monthly_contribution = c`, `ipca` from `get_macro_params()`.
- If `P(0) ≥ confidence` → return `(0, P(0), True)`.
- Upper bound R$ 50.000/mês; if `P(50k) < confidence` → `attainable=False`, return the
  bound's probability.
- Else binary search to tolerance **R$ 50**, return upper midpoint. `iterations` ≤ 12.

**Router**: `api/routers/simulation.py` (same file, same conversion helpers).

## 4. GoalCard integration

- New secondary action beside the existing FV suggestion: **"Refinar com Monte Carlo"**
  → calls `/api/goal/solve` (react-query mutation), loading state ("calculando… ~10s"),
  then renders "Aporte para 80% de confiança: R$ X.XXX/mês (P=82%)" with the existing
  "Aplicar" pattern mutating `scenario.portfolio.monthlyContribution`.
- `attainable=false` → message reusing the card's existing "unreachable" state styling.
- The instantaneous FV suggestion stays — solver is the refinement, not a replacement.

## 5. Errors & failure modes

- Solver timeout/cold start: react-query mutation with `retry: 1`; error renders the
  card's ErrorCard-style inline message with retry.
- Bridge with stale quotes: uses `avgPrice` fallback silently (same as /historico);
  the preview shows totals so the user sees what they're approving.
- Concurrency: solver is stateless; no persistence anywhere new (localStorage only).

## 6. Testing

- `web/tests/portfolio-bridge.test.ts`: mapping per class, BDR bucket, value-weighted
  yields, RF split rule (isTaxExempt, name regex), USD conversion, weight normalization
  Σ=1, skipped entries, null on empty stores, aporte passthrough.
- `api/tests/test_goal_solve.py`: P monotone in contribution; already-attainable → 0;
  unattainable at bound → flag; seed reproducibility; tolerance respected; endpoint
  validation (confidence bounds).
- Drawer test: button disabled states, preview values, confirm writes form values.
- GoalCard test: mutation states (loading/success/apply/unattainable) with mocked API.
- e2e: ativos fixture → drawer import → simulate renders with imported classes.

## Risks

- **Render free tier**: solver worst case ≈ 12 × 1500-trajectory runs. Mitigated by the
  1500 cap + tolerance; measured in tests with a timing assertion is NOT included
  (flaky) — manual smoke instead.
- **Per-ticker yields garbage-in**: imported `expectedYield` comes from user-maintained
  fields; the preview + editability after import are the guardrails.
- **Store field addition**: `lastRealImportAt` must not break v5 persistence — covered
  by a migration test asserting old payloads hydrate with `null`.
