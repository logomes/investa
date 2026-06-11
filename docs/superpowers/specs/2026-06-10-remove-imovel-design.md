# Remove Imóvel — Design

**Date:** 2026-06-10
**Status:** Implemented
**Owner:** lucgomes

## Problem

The system was born as an "Imóvel vs Carteira" comparator. The user decided to retire the
real-estate side entirely and refocus the product on investment analysis. That removal is
not a simple delete: ~3K lines across 10 categories depend on it, and six pages exist
*because* of the dual comparison format (Visão Geral, Carteira, Sensibilidade, Risco,
Tributação, Exportar). Ripping out one side of every chart would leave the UI hollow.

## Solution (TL;DR)

Replace the imóvel side of every comparison with a **configurable passive benchmark**
(CDI | Selic | IPCA+x%, default CDI), then delete all real-estate code end to end.

Key insight from design exploration: the backend **already** computes a Selic benchmark
(`simulate_benchmark`, `api/core/models.py:709`) returned as `SimulateOut.benchmark`, and
the scenario drawer already has a `BenchmarkSection` (Selic rate + IR fields). We
generalize what exists instead of building new infrastructure.

Executed in **two phases**, each landing green:

1. **Fase 1 — Benchmark first.** Generalize the benchmark (rate kind selector, monthly
   contributions, fair comparison), add `sensitivity_portfolio`, and migrate every
   comparative page from imóvel to benchmark. Imóvel still exists; nothing breaks.
2. **Fase 2 — Deletion.** Remove imóvel from web, API, tests, nav, docs. Almost purely
   mechanical deletes because no page references it anymore.

## Decisions (brainstorming, user-approved)

| Topic | Decision |
|---|---|
| Comparison format | Keep dual format; "other side" = passive benchmark |
| Benchmark UX | Selector CDI \| Selic \| IPCA+x% in scenario drawer; default CDI |
| Store migration | Silent — drop `realEstate`/`financing`, keep everything else |
| Identity | Topbar subtitle → "Análise · Carteira vs Benchmark · {horizon} anos" |
| Old fase-4 docs | Untouched, kept as history; this spec records the removal |
| Tributação page | Becomes mono-portfolio tax view (no ITBI / aluguel IR / imóvel capital gain) |
| Execution | Two phases (B), each closing with full green suite |

## Out of scope

- Renaming the product ("investa" stays).
- Monte Carlo for the benchmark — it stays deterministic (a reference line, not a
  stochastic scenario).
- Backend resolving CDI/Selic/IPCA rates itself — the frontend already fetches
  `/api/macro` (BCB via Cloudflare Worker) and keeps resolving the nominal rate.
- New features on the freed-up pages beyond the benchmark substitution.

---

## Fase 1 — Benchmark generalization + page migration

### Backend

**`core/config.py` — `BenchmarkParams`** (line ~197) generalizes from Selic-only:

```python
@dataclass
class BenchmarkParams:
    capital: float
    annual_rate: float          # nominal a.a. (resolved by the frontend)
    tax_rate: float = 0.175
    monthly_contribution: float = 0.0
    label: str = "CDI (líquido)"

    def net_yield(self) -> float:
        return self.annual_rate * (1 - self.tax_rate)
```

**`core/models.py` — `simulate_benchmark`** gains monthly contributions so the benchmark
receives the *same* cash flow as the portfolio (today it only compounds initial capital —
an unfair comparison). Monthly compounding: `rate_m = (1 + net) ** (1/12) - 1`; annual
sampling for the output series, same shape as today (`SimulationResult`).

**`core/models.py` — new `sensitivity_portfolio`** — the Sensibilidade page currently
consumes `sensitivity_real_estate` output exclusively, so deletion requires a
portfolio-based tornado. Same row contract (`parameter`, `pessimistic`, `optimistic` =
final patrimony). Deltas, mirroring the spirit of `_build_sensitivity_deltas`:

| Parameter | Pessimistic | Optimistic |
|---|---|---|
| Yield médio da carteira | −1.5 pp | +1.5 pp |
| Ganho de capital médio | −1.5 pp | +1.5 pp |
| Aporte mensal | −25 % | +25 % |
| IR efetivo médio | +5 pp | −5 pp |

(Applied to all assets proportionally; one simulation per variation, base scenario otherwise.)

**`schemas/inputs.py` — `BenchmarkInput`** becomes:

```python
class BenchmarkInput(_CamelModel):
    kind: Literal["cdi", "selic", "ipca_plus"] = "cdi"
    annual_rate: float = Field(ge=0, le=1.0)   # replaces selic_rate
    ipca_spread: float = Field(default=0.0, ge=0, le=0.5)  # only meaningful for ipca_plus
    tax_rate: float = Field(default=0.175, ge=0, le=1.0)
```

`kind` drives the result label ("CDI (líquido)", "Selic (líquido)", "IPCA + x% (líquido)").
The frontend resolves `annual_rate` (for `ipca_plus`: `ipca + spread`). Note `kind` reuses
the vocabulary of the existing `IndexerKind` literal in `config.py`.

**`routers/simulation.py`**: `_to_benchmark_params` maps the new fields and passes
`payload.portfolio.monthly_contribution`; `/simulate` switches `sensitivity` from
`sensitivity_real_estate` to `sensitivity_portfolio`. The `real_estate` result keeps
flowing in Fase 1 (the /imovel page still exists). `tax_comparison` rows drop the imóvel
scenario and present carteira (per asset-class grouping) + benchmark.

### Frontend

**`lib/api-types.ts`**: `BenchmarkInput` mirrors the new schema
(`kind`, `annualRate`, `ipcaSpread`, `taxRate`).

**`lib/defaults.ts`**: `DEFAULT_SCENARIO.benchmark = { kind: "cdi", annualRate: <CDI atual ~0.1465>, ipcaSpread: 0, taxRate: 0.175 }`.

**`lib/store.ts`**: bump `investa-scenario-v3` → **v4** with a `migrate` that reshapes
`benchmark` (`selicRate` → `annualRate`, `kind: "selic"` to preserve the user's prior
intent). All other persisted state passes through.

**`components/scenario-drawer/sections/BenchmarkSection.tsx`**: selector (CDI | Selic |
IPCA+x%) + rate input auto-prefilled from `/api/macro` when the kind changes (still
editable — preserves today's manual-override behavior), spread % input visible only for
IPCA+x%, IR field unchanged. `schema.ts` updated accordingly.

**Page migration** (each card keeps its visual structure; the imóvel series/column is
replaced by `data.benchmark`, which the API already returns):

- `components/visao-geral/` — KPI row, `EvolutionCard`, `MonthlyIncomeCard`: compare
  carteira vs benchmark.
- `components/carteira/CarteiraPageContent.tsx` + `YieldComparisonCard`: yield comparisons
  vs benchmark net yield (removes the `imovel-derive` `grossYield`/`netYield` imports in
  `lib/carteira-derive.ts`).
- `components/sensibilidade/`: consumes the new portfolio tornado (row labels change;
  table/chart components unchanged).
- Risco: portfolio MC percentiles + benchmark deterministic line as overlay; the imóvel
  fan is no longer rendered (data still arrives until Fase 2).
- Tributação: mono-portfolio rows + benchmark from the reshaped `tax_comparison`.
- `lib/exportar-csv.ts`: imóvel sheets replaced by benchmark columns.
- `components/shell/Topbar.tsx:74`: subtitle → "Análise · Carteira vs Benchmark ·
  {scenario.horizon} anos" (read from store; hydration-safe since the page already uses
  the store client-side).

### Fase 1 tests

- `api`: `simulate_benchmark` with contributions (closed-form check on small horizon),
  `sensitivity_portfolio` row contract + monotonicity, schema validation of the new
  `BenchmarkInput`.
- `web`: store migration v3→v4, `BenchmarkSection` selector behavior (spread field
  visibility, macro prefill), updated card tests, `e2e/fixtures/api-mocks.ts` gains the
  new benchmark shape.

---

## Fase 2 — Deletion

### Web

- Delete: `app/imovel/`, `components/imovel/` (9 files), `lib/imovel-derive.ts`,
  `components/scenario-drawer/sections/RealEstateSection.tsx` + `FinancingSection.tsx`.
- `lib/nav.ts:31`: remove the Imóvel nav item.
- `lib/api-types.ts`: remove `FinancingInput`, `RealEstateInput`,
  `SimulateInput.realEstate`, `SimulateMonteCarloInput.realEstate`,
  `SimulateOut.realEstate`, `SimulateMonteCarloOut.realEstate`.
- `lib/defaults.ts`: remove `DEFAULT_SCENARIO.realEstate` and `DEFAULT_FINANCING`.
- `lib/store.ts`: bump **v4 → v5**, migration silently drops `realEstate` from the
  persisted scenario.
- Scenario drawer `schema.ts` / form assembly: drop imóvel/financiamento sections.
- Tests deleted: `imovel-derive.test.ts`, `imovel-page.test.tsx`; mocks and remaining
  tests scrubbed of `realEstate`.

### API

- `core/models.py`: delete `simulate_real_estate`, `_simulate_real_estate_cash`,
  `_simulate_real_estate_financed`, `simulate_real_estate_mc`,
  `sensitivity_real_estate` (~600 lines).
- `core/config.py`: delete `FinancingParams`, `RealEstateParams`.
- `schemas/`: delete `FinancingInput`, `RealEstateInput`; remove `real_estate` from
  `SimulateIn`/`SimulateOut`/MC schemas.
- `routers/simulation.py`: delete `_to_real_estate_params`, `_build_sensitivity_deltas`
  (replaced in Fase 1), and all real-estate wiring; `/simulate-mc` returns portfolio only.
- Tests: delete `test_financing.py`; scrub `test_models.py`, `test_monte_carlo.py`,
  `test_endpoint_*`, `test_integration.py`, `test_schemas_inputs.py`.

### Docs

- `docs/superpowers/plans|specs/*fase4-imovel*` stay untouched (history). This spec is the
  record of the removal.

---

## Verification (each fase)

`pytest` (api), `vitest run` (web), `tsc --noEmit`, `next lint`, Playwright e2e. Manual
smoke: drawer selector round-trips through `/simulate`, all six pages render with
benchmark data, localStorage from the previous version migrates without data loss.

## Risks

- **Persisted-state regressions**: two store bumps (v4, v5). Mitigated by migration unit
  tests with captured v3 payloads.
- **Render free tier**: `sensitivity_portfolio` adds 8 extra simulations per `/simulate`
  call — trivial next to the MC endpoint's budget, but verified against the ~30 s timeout.
- **Fairness semantics**: adding aportes to the benchmark changes its series vs today's;
  KPI deltas on Visão Geral will shift. Intentional (documented here).
