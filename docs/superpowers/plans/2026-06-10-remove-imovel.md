# Remove Imóvel (Benchmark Substitution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all real-estate (imóvel) functionality and refocus every comparative page on "Carteira vs passive benchmark" (CDI | Selic | IPCA+x%, default CDI).

**Architecture:** Two phases on one branch. Fase 1 generalizes the existing Selic benchmark (kind selector, monthly contributions, portfolio tornado, carteira-vs-benchmark tax view) and migrates all six pages off imóvel — the imóvel code still exists and nothing breaks. Fase 2 is then a near-mechanical deletion of imóvel from web, API, and tests.

**Tech Stack:** FastAPI + Pydantic v2 (camelCase aliases) + numpy/pandas; Next.js 14 App Router + TypeScript strict + Zustand persist + react-hook-form/zod + vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-06-10-remove-imovel-design.md` (Approved)

**Repo root:** `/home/lucgomes/workspace/investa`. Commands below assume `api/` for Python (activate the project venv if one exists, e.g. `source .venv/bin/activate`) and `web/` for Node.

**Conventions that matter here:**
- API JSON is camelCase; Pydantic models use snake_case fields with an `alias_generator` (`_CamelModel` in `api/schemas/*.py`). TS types in `web/lib/api-types.ts` mirror the camelCase side.
- The Zustand store (`web/lib/store.ts`) persists under the key `investa-scenario-v3` with **no** `version` option today (zustand therefore writes `"version": 0`). We add `version: 4` + `migrate` in Fase 1 and bump to 5 in Fase 2. Do NOT rename the storage key — that would silently drop user data.
- Frontend unit tests mock the API, so backend and frontend tasks can land independently; each task must end green.

---

## Setup

- [ ] **Step 0.1: Create the working branch**

```bash
cd /home/lucgomes/workspace/investa
git checkout -b refactor/remove-imovel
```

---

# FASE 1 — Benchmark generalizado + migração das páginas

### Task 1: Backend — generalize `BenchmarkParams` + `simulate_benchmark`

The current benchmark is Selic-only and ignores monthly contributions (it only compounds initial capital), which makes "carteira vs benchmark" unfair. Generalize to any nominal annual rate, add the same begin-of-year contribution flow `simulate_portfolio` uses, and make the label injectable.

**Files:**
- Modify: `api/core/config.py:196-203` (class `BenchmarkParams`)
- Modify: `api/core/models.py:709-733` (function `simulate_benchmark`)
- Create: `api/tests/test_benchmark.py`

- [ ] **Step 1.1: Write the failing tests**

Create `api/tests/test_benchmark.py`:

```python
"""Tests for the generalized passive benchmark (CDI/Selic/IPCA+x)."""
import numpy as np
import pytest

from core.config import BenchmarkParams
from core.models import simulate_benchmark


def test_no_contribution_compounds_capital_at_net_rate():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10, tax_rate=0.0)
    result = simulate_benchmark(params, horizon_years=2)
    np.testing.assert_allclose(result.patrimony, [100_000, 110_000, 121_000])


def test_tax_rate_reduces_effective_rate():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10, tax_rate=0.175)
    result = simulate_benchmark(params, horizon_years=1)
    assert result.patrimony[1] == pytest.approx(100_000 * (1 + 0.10 * (1 - 0.175)))


def test_monthly_contributions_enter_begin_of_year():
    # rate 0 → patrimony grows exactly 12 × monthly per year
    params = BenchmarkParams(
        capital=10_000, annual_rate=0.0, tax_rate=0.0,
        monthly_contribution=1_000, contribution_inflation_indexed=False,
    )
    result = simulate_benchmark(params, horizon_years=2)
    np.testing.assert_allclose(result.patrimony, [10_000, 22_000, 34_000])


def test_contributions_can_be_ipca_indexed():
    params = BenchmarkParams(
        capital=10_000, annual_rate=0.0, tax_rate=0.0,
        monthly_contribution=1_000, contribution_inflation_indexed=True,
    )
    result = simulate_benchmark(params, horizon_years=2, ipca=0.10)
    # year-1 aporte 12k, year-2 aporte 12k × 1.1
    assert result.patrimony[2] == pytest.approx(10_000 + 12_000 + 13_200)


def test_label_propagates_to_result():
    params = BenchmarkParams(capital=10_000, annual_rate=0.10, label="CDI (líquido)")
    result = simulate_benchmark(params, horizon_years=1)
    assert result.label == "CDI (líquido)"


def test_annual_income_matches_yield_on_prior_year_patrimony():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10, tax_rate=0.0)
    result = simulate_benchmark(params, horizon_years=3)
    assert result.annual_income[2] == pytest.approx(result.patrimony[1] * 0.10)


def test_rejects_non_positive_horizon():
    with pytest.raises(ValueError):
        simulate_benchmark(BenchmarkParams(), horizon_years=0)
```

- [ ] **Step 1.2: Run to verify failure**

Run: `cd api && python -m pytest tests/test_benchmark.py -v`
Expected: FAIL — `TypeError: BenchmarkParams.__init__() got an unexpected keyword argument 'annual_rate'`

- [ ] **Step 1.3: Implement `BenchmarkParams`**

In `api/core/config.py`, replace the whole `BenchmarkParams` block (lines 194-203):

```python
# ---------- Reference benchmark (CDI / Selic / IPCA+x, líquido) ----------

@dataclass(slots=True)
class BenchmarkParams:
    capital: float = 230_000.0
    annual_rate: float = SELIC_RATE
    tax_rate: float = 0.175  # IR 17.5% (>2 anos)
    monthly_contribution: float = 0.0
    contribution_inflation_indexed: bool = True
    label: str = "CDI (líquido)"

    def net_yield(self) -> float:
        return self.annual_rate * (1 - self.tax_rate)
```

- [ ] **Step 1.4: Implement `simulate_benchmark`**

In `api/core/models.py`, replace the whole `simulate_benchmark` function (lines 709-733):

```python
def simulate_benchmark(
    params: BenchmarkParams,
    horizon_years: int,
    ipca: float = 0.0,
) -> SimulationResult:
    """Passive benchmark (CDI / Selic / IPCA+x) with reinvestment and aportes.

    Receives the same begin-of-year contribution flow as `simulate_portfolio`,
    so "carteira vs benchmark" compares identical cash flows.
    """
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    years = np.arange(0, horizon_years + 1)
    rate = params.net_yield()
    patrimony = params.capital * (1 + rate) ** years

    annual_base = 12.0 * params.monthly_contribution
    if annual_base > 0:
        indexed = params.contribution_inflation_indexed
        contribution_pv = np.zeros_like(patrimony, dtype=float)
        for y in range(1, horizon_years + 1):
            total = 0.0
            for t in range(y):
                aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0)
                total += aporte_t * (1 + rate) ** (y - t)
            contribution_pv[y] = total
        patrimony = patrimony + contribution_pv

    annual_income = np.array([
        patrimony[max(y - 1, 0)] * rate
        for y in years
    ])
    cumulative_income = np.cumsum(annual_income)

    return SimulationResult(
        years=years,
        patrimony=patrimony,
        annual_income=annual_income,
        cumulative_income=cumulative_income,
        label=params.label,
        color="#F39C12",
    )
```

- [ ] **Step 1.5: Fix existing callers/tests of the old field names**

Run: `grep -rn "selic_rate\|Tesouro Selic" api/tests/ api/routers/ api/core/`

- In `api/routers/simulation.py:78-83` (`_to_benchmark_params`) change `selic_rate=input_bench.selic_rate` → `annual_rate=input_bench.selic_rate` (temporary shim — the schema is reworked in Task 4).
- In any test constructing `BenchmarkParams(selic_rate=...)` rename the kwarg to `annual_rate=`. Any test asserting `label == "Tesouro Selic (líquido)"` should now construct with `label="Tesouro Selic (líquido)"` explicitly or assert the new default `"CDI (líquido)"` — prefer passing the label explicitly to keep the test's intent.

- [ ] **Step 1.6: Run the full API suite**

Run: `cd api && python -m pytest -q`
Expected: PASS (the endpoint tests still pass because `_to_benchmark_params` was shimmed)

- [ ] **Step 1.7: Commit**

```bash
git add api/core/config.py api/core/models.py api/tests/test_benchmark.py api/routers/simulation.py api/tests/
git commit -m "feat(api): generalize benchmark (any rate, aportes, label)"
```

---

### Task 2: Backend — `sensitivity_portfolio`

The Sensibilidade page consumes the `/simulate` `sensitivity` field, whose only implementation is `sensitivity_real_estate`. Build the portfolio tornado that replaces it.

**Files:**
- Modify: `api/core/models.py` (add function after `simulate_portfolio_mc`, around line 707)
- Create: `api/tests/test_sensitivity_portfolio.py`

- [ ] **Step 2.1: Write the failing tests**

Create `api/tests/test_sensitivity_portfolio.py`:

```python
"""Tests for the portfolio tornado sensitivity."""
from core.config import AssetClass, PortfolioParams
from core.models import sensitivity_portfolio


def _params() -> PortfolioParams:
    return PortfolioParams(
        capital=100_000,
        monthly_contribution=1_000,
        contribution_inflation_indexed=False,
        assets=[
            AssetClass("A", 0.5, 0.10, 0.02, 0.15, volatility=0.10),
            AssetClass("B", 0.5, 0.08, 0.01, 0.00, volatility=0.20),
        ],
    )


def test_four_rows_with_expected_labels():
    df = sensitivity_portfolio(_params(), horizon_years=10)
    assert list(df["Parâmetro"]) == [
        "Yield da carteira (±1,5pp)",
        "Ganho de capital (±1,5pp)",
        "Aporte mensal (±25%)",
        "IR efetivo (±5pp)",
    ]
    assert set(df.columns) == {"Parâmetro", "Cenário Pessimista", "Cenário Otimista"}


def test_optimistic_always_geq_pessimistic():
    df = sensitivity_portfolio(_params(), horizon_years=10)
    assert (df["Cenário Otimista"] >= df["Cenário Pessimista"]).all()


def test_base_params_are_not_mutated():
    params = _params()
    sensitivity_portfolio(params, horizon_years=10)
    assert params.assets[0].expected_yield == 0.10
    assert params.assets[0].tax_rate == 0.15
    assert params.monthly_contribution == 1_000


def test_zero_contribution_makes_aporte_row_flat():
    params = _params()
    params.monthly_contribution = 0.0
    df = sensitivity_portfolio(params, horizon_years=10)
    row = df[df["Parâmetro"] == "Aporte mensal (±25%)"].iloc[0]
    assert row["Cenário Pessimista"] == row["Cenário Otimista"]
```

- [ ] **Step 2.2: Run to verify failure**

Run: `cd api && python -m pytest tests/test_sensitivity_portfolio.py -v`
Expected: FAIL — `ImportError: cannot import name 'sensitivity_portfolio'`

- [ ] **Step 2.3: Implement**

In `api/core/models.py`, add after `simulate_portfolio_mc` (before `simulate_benchmark`):

```python
def sensitivity_portfolio(
    base_params: PortfolioParams,
    horizon_years: int,
    ipca: float = 0.0,
) -> pd.DataFrame:
    """Tornado-style sensitivity for the portfolio: vary one dimension at a time.

    Deltas are applied uniformly to every asset (clamped to valid ranges) so the
    rows read as carteira-level scenarios, not per-asset ones.
    """
    def final_patrimony(params: PortfolioParams) -> float:
        result = simulate_portfolio(
            params, horizon_years, reinvest_income=True, ipca=ipca,
        )
        return float(result.patrimony[-1])

    def variant(
        *,
        yield_delta: float = 0.0,
        gain_delta: float = 0.0,
        contribution_mult: float = 1.0,
        tax_delta: float = 0.0,
    ) -> PortfolioParams:
        assets = [
            AssetClass(
                name=a.name,
                weight=a.weight,
                expected_yield=a.expected_yield + yield_delta,
                capital_gain=a.capital_gain + gain_delta,
                tax_rate=min(max(a.tax_rate + tax_delta, 0.0), 1.0),
                note=a.note,
                volatility=a.volatility,
            )
            for a in base_params.assets
        ]
        return PortfolioParams(
            capital=base_params.capital,
            assets=assets,
            monthly_contribution=base_params.monthly_contribution * contribution_mult,
            contribution_inflation_indexed=base_params.contribution_inflation_indexed,
        )

    variations = [
        ("Yield da carteira (±1,5pp)",
         variant(yield_delta=-0.015), variant(yield_delta=0.015)),
        ("Ganho de capital (±1,5pp)",
         variant(gain_delta=-0.015), variant(gain_delta=0.015)),
        ("Aporte mensal (±25%)",
         variant(contribution_mult=0.75), variant(contribution_mult=1.25)),
        ("IR efetivo (±5pp)",
         variant(tax_delta=0.05), variant(tax_delta=-0.05)),
    ]

    return pd.DataFrame([
        {
            "Parâmetro": label,
            "Cenário Pessimista": final_patrimony(pessimistic),
            "Cenário Otimista": final_patrimony(optimistic),
        }
        for label, pessimistic, optimistic in variations
    ])
```

- [ ] **Step 2.4: Run tests**

Run: `cd api && python -m pytest tests/test_sensitivity_portfolio.py -v`
Expected: PASS (4 tests)

- [ ] **Step 2.5: Commit**

```bash
git add api/core/models.py api/tests/test_sensitivity_portfolio.py
git commit -m "feat(api): add sensitivity_portfolio tornado"
```

---

### Task 3: Backend — `annual_tax_comparison` carteira vs benchmark

**Files:**
- Modify: `api/core/models.py:823-857` (function `annual_tax_comparison`)
- Test: extend `api/tests/test_benchmark.py`

- [ ] **Step 3.1: Write the failing test**

Append to `api/tests/test_benchmark.py`:

```python
from core.config import AssetClass, PortfolioParams
from core.models import annual_tax_comparison


def test_tax_comparison_rows_are_portfolio_and_benchmark():
    portfolio = PortfolioParams(
        capital=100_000,
        assets=[AssetClass("A", 1.0, 0.10, 0.0, 0.20)],
    )
    benchmark = BenchmarkParams(
        capital=100_000, annual_rate=0.12, tax_rate=0.175, label="CDI (líquido)",
    )
    df = annual_tax_comparison(portfolio, benchmark)

    assert list(df["Cenário"]) == ["Carteira Diversificada", "CDI (líquido)"]
    pf = df.iloc[0]
    assert pf["Receita Bruta"] == pytest.approx(10_000)
    assert pf["Imposto Anual"] == pytest.approx(2_000)
    bench = df.iloc[1]
    assert bench["Receita Bruta"] == pytest.approx(12_000)
    assert bench["Imposto Anual"] == pytest.approx(12_000 * 0.175)
    assert bench["Carga Tributária Efetiva"] == pytest.approx(0.175)
```

- [ ] **Step 3.2: Run to verify failure**

Run: `cd api && python -m pytest tests/test_benchmark.py::test_tax_comparison_rows_are_portfolio_and_benchmark -v`
Expected: FAIL — old signature takes `(real_estate, portfolio)`; `BenchmarkParams` has no `gross_annual_rent`

- [ ] **Step 3.3: Implement**

In `api/core/models.py`, replace the whole `annual_tax_comparison` function:

```python
def annual_tax_comparison(
    portfolio: PortfolioParams,
    benchmark: BenchmarkParams,
) -> pd.DataFrame:
    """Compare annual tax burden: carteira vs passive benchmark."""
    pf_gross_income = sum(
        portfolio.capital * a.weight * a.expected_yield
        for a in portfolio.assets
    )
    pf_tax = sum(
        portfolio.capital * a.weight * a.expected_yield * a.tax_rate
        for a in portfolio.assets
    )

    bench_gross_income = benchmark.capital * benchmark.annual_rate
    bench_tax = bench_gross_income * benchmark.tax_rate

    return pd.DataFrame([
        {
            "Cenário": "Carteira Diversificada",
            "Receita Bruta": pf_gross_income,
            "Imposto Anual": pf_tax,
            "Receita Líquida": pf_gross_income - pf_tax,
            "Carga Tributária Efetiva": pf_tax / pf_gross_income if pf_gross_income else 0.0,
        },
        {
            "Cenário": benchmark.label,
            "Receita Bruta": bench_gross_income,
            "Imposto Anual": bench_tax,
            "Receita Líquida": bench_gross_income - bench_tax,
            "Carga Tributária Efetiva": benchmark.tax_rate if bench_gross_income else 0.0,
        },
    ])
```

- [ ] **Step 3.4: Fix the router call and other callers**

`grep -rn "annual_tax_comparison" api/` — in `api/routers/simulation.py:134` change to `annual_tax_comparison(pf_params, bench_params)` (full router rework lands in Task 4; this keeps the suite green now). Update any direct tests of the old signature found by the grep (e.g. in `api/tests/test_models.py`) to the new portfolio/benchmark form, mirroring Step 3.1.

- [ ] **Step 3.5: Run the full API suite**

Run: `cd api && python -m pytest -q`
Expected: PASS. Note: `api/tests/test_endpoint_simulate.py` may assert the old "Imóvel" tax row — update those assertions to expect `"Carteira Diversificada"` and the benchmark label.

- [ ] **Step 3.6: Commit**

```bash
git add api/core/models.py api/routers/simulation.py api/tests/
git commit -m "feat(api): tax comparison is carteira vs benchmark"
```

---

### Task 4: Backend — new `BenchmarkInput` schema + router wiring

**Files:**
- Modify: `api/schemas/inputs.py:69-71` (class `BenchmarkInput`)
- Modify: `api/routers/simulation.py` (benchmark mapping, label, sensitivity switch)
- Test: `api/tests/test_schemas_inputs.py`, `api/tests/test_endpoint_simulate.py`

- [ ] **Step 4.1: Write failing schema tests**

Append to `api/tests/test_schemas_inputs.py`:

```python
from schemas.inputs import BenchmarkInput


def test_benchmark_input_accepts_kind_and_rate():
    b = BenchmarkInput.model_validate(
        {"kind": "ipca_plus", "annualRate": 0.105, "ipcaSpread": 0.06, "taxRate": 0.15}
    )
    assert b.kind == "ipca_plus"
    assert b.annual_rate == 0.105
    assert b.ipca_spread == 0.06


def test_benchmark_input_defaults():
    b = BenchmarkInput.model_validate({"annualRate": 0.1465})
    assert b.kind == "cdi"
    assert b.ipca_spread == 0.0
    assert b.tax_rate == 0.175
```

- [ ] **Step 4.2: Run to verify failure**

Run: `cd api && python -m pytest tests/test_schemas_inputs.py -v -k benchmark`
Expected: FAIL — `BenchmarkInput` has no field `kind`

- [ ] **Step 4.3: Implement the schema**

In `api/schemas/inputs.py`, replace `BenchmarkInput`:

```python
class BenchmarkInput(_CamelModel):
    kind: Literal["cdi", "selic", "ipca_plus"] = "cdi"
    annual_rate: float = Field(ge=0, le=1.0)
    ipca_spread: float = Field(default=0.0, ge=0, le=0.5)
    tax_rate: float = Field(default=0.175, ge=0, le=1.0)
```

- [ ] **Step 4.4: Rewire the router**

In `api/routers/simulation.py`:

1. Imports: in the `core.models` import block, replace `sensitivity_real_estate` with `sensitivity_portfolio`. Add `BenchmarkInput` to the `schemas.inputs` import line (`from schemas.inputs import BenchmarkInput, SimulateInput, SimulateMonteCarloInput`).
2. Delete `_build_sensitivity_deltas` (lines 86-98) — now unused.
3. Replace `_to_benchmark_params` (lines 78-83) with:

```python
def _benchmark_label(input_bench: BenchmarkInput) -> str:
    if input_bench.kind == "cdi":
        return "CDI (líquido)"
    if input_bench.kind == "selic":
        return "Selic (líquido)"
    return f"IPCA + {input_bench.ipca_spread * 100:.1f}% (líquido)"


def _to_benchmark_params(
    input_bench: BenchmarkInput, capital: float, pf_params: PortfolioParams,
) -> BenchmarkParams:
    return BenchmarkParams(
        capital=capital,
        annual_rate=input_bench.annual_rate,
        tax_rate=input_bench.tax_rate,
        monthly_contribution=pf_params.monthly_contribution,
        contribution_inflation_indexed=pf_params.contribution_inflation_indexed,
        label=_benchmark_label(input_bench),
    )
```

4. In `simulate()` replace the param/sensitivity block: build `pf_params` BEFORE `bench_params`, then:

```python
    pf_params = _to_portfolio_params(payload.portfolio)
    re_params = _to_real_estate_params(payload.real_estate)
    bench_params = _to_benchmark_params(payload.benchmark, payload.capital, pf_params)
    macro = get_macro_params()
```

and:

```python
    bench_result = simulate_benchmark(
        bench_params, horizon_years=payload.horizon, ipca=macro.ipca,
    )

    sens_rows = sensitivity_portfolio(pf_params, payload.horizon, ipca=macro.ipca)
```

(`re_result` and the MC endpoint stay untouched in Fase 1 — `/imovel` still exists.)

- [ ] **Step 4.5: Update endpoint tests**

Run: `grep -rn "selicRate\|selic_rate" api/tests/ web/e2e/` — every `/api/simulate` payload fixture (look in `api/tests/conftest.py`, `test_endpoint_simulate.py`, `test_integration.py`) replaces

```python
"benchmark": {"selicRate": 0.1475, "taxRate": 0.175},
```

with

```python
"benchmark": {"kind": "cdi", "annualRate": 0.1465, "taxRate": 0.175},
```

Update sensitivity assertions in `test_endpoint_simulate.py`: rows are now the 4 portfolio labels from Task 2 (e.g. assert `"Yield da carteira (±1,5pp)"` present, length 4). Update `test_endpoint_portfolio.py` defaults-endpoint assertions: the `benchmark` dict now has keys `annualRate`, `taxRate`, `monthlyContribution`, `contributionInflationIndexed`, `label`, `capital` (no `selicRate`).

- [ ] **Step 4.6: Run the full API suite**

Run: `cd api && python -m pytest -q`
Expected: PASS

- [ ] **Step 4.7: Commit**

```bash
git add api/schemas/inputs.py api/routers/simulation.py api/tests/
git commit -m "feat(api): BenchmarkInput kind selector + portfolio sensitivity in /simulate"
```

---

### Task 5: Frontend core — types, defaults, drawer schema, store v4 migration

**Files:**
- Modify: `web/lib/api-types.ts:44-47, 55-62`
- Modify: `web/lib/defaults.ts:32-35`
- Modify: `web/components/scenario-drawer/schema.ts:51-54`
- Modify: `web/lib/store.ts:38-49`
- Create: `web/tests/store-migration.test.ts`

- [ ] **Step 5.1: Update `web/lib/api-types.ts`**

Replace the `BenchmarkInput` type (lines 44-47):

```ts
export type BenchmarkKind = "cdi" | "selic" | "ipca_plus";

export type BenchmarkInput = {
  kind: BenchmarkKind;
  annualRate: number;
  ipcaSpread: number;
  taxRate: number;
};
```

- [ ] **Step 5.2: Update `web/lib/defaults.ts`**

Replace the `benchmark` block in `DEFAULT_SCENARIO` (lines 32-35):

```ts
  benchmark: {
    kind: "cdi",
    annualRate: 0.1465,  // prefilled live from /api/macro in the drawer
    ipcaSpread: 0,
    taxRate: 0.175,
  },
```

- [ ] **Step 5.3: Update `web/components/scenario-drawer/schema.ts`**

Replace `benchmarkSchema` (lines 51-54):

```ts
export const benchmarkSchema = z.object({
  kind: z.enum(["cdi", "selic", "ipca_plus"]),
  annualRate: z.number().min(0).max(1),
  ipcaSpread: z.number().min(0).max(0.5),
  taxRate: z.number().min(0).max(1),
});
```

- [ ] **Step 5.4: Write the failing migration test**

Create `web/tests/store-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useScenarioStore } from "@/lib/store";

const V3_PAYLOAD = {
  state: {
    scenario: {
      capital: 111_000,
      horizon: 7,
      reinvest: true,
      realEstate: { propertyValue: 230_000, monthlyRent: 1_500 },
      portfolio: {
        capital: 111_000,
        monthlyContribution: 500,
        contributionInflationIndexed: true,
        assets: [],
      },
      benchmark: { selicRate: 0.12, taxRate: 0.2 },
    },
    mc: { nTrajectories: 2000, seed: null, targetPatrimony: 0 },
    goalTarget: 500_000,
  },
  version: 0,  // pre-v4 stores were written without a version option (zustand default 0)
};

describe("store migration v3 → v4", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reshapes the persisted benchmark, preserving the Selic intent", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect(s.scenario.benchmark).toEqual({
      kind: "selic",
      annualRate: 0.12,
      ipcaSpread: 0,
      taxRate: 0.2,
    });
  });

  it("keeps all other persisted fields intact", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect(s.scenario.capital).toBe(111_000);
    expect(s.scenario.horizon).toBe(7);
    expect(s.scenario.portfolio.monthlyContribution).toBe(500);
    expect(s.goalTarget).toBe(500_000);
  });
});
```

- [ ] **Step 5.5: Run to verify failure**

Run: `cd web && npx vitest run tests/store-migration.test.ts`
Expected: FAIL — benchmark still has `selicRate` shape (no migrate configured)

- [ ] **Step 5.6: Add `version` + `migrate` to the store**

In `web/lib/store.ts`, replace the persist options object (lines 38-49):

```ts
    {
      // Storage key name is historical — do NOT rename (renaming drops user data).
      // Schema changes are handled via `version` + `migrate` below.
      name: "investa-scenario-v3",
      // v4: benchmark reshaped from {selicRate,taxRate} to {kind,annualRate,ipcaSpread,taxRate}.
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          scenario?: SimulateInput & {
            benchmark?: Partial<SimulateInput["benchmark"]> & { selicRate?: number };
          };
        };
        if ((version ?? 0) < 4 && state?.scenario) {
          const old = state.scenario.benchmark ?? {};
          state.scenario.benchmark = {
            kind: "selic",  // pre-v4 benchmark was Tesouro Selic — preserve intent
            annualRate: old.selicRate ?? DEFAULT_SCENARIO.benchmark.annualRate,
            ipcaSpread: 0,
            taxRate: old.taxRate ?? 0.175,
          };
        }
        return state;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        mc: state.mc,
        goalTarget: state.goalTarget,
      }),
      skipHydration: true,
    }
```

- [ ] **Step 5.7: Run tests + typecheck**

Run: `cd web && npx vitest run tests/store-migration.test.ts && npx tsc --noEmit`
Expected: migration tests PASS. `tsc` will flag every consumer of the old benchmark shape (`selicRate` in `carteira-derive.ts`, `BenchmarkSection.tsx`, tests). Those are fixed in Tasks 6-8 — if you need this commit green on `tsc`, fix only the trivial ones now: in `web/components/scenario-drawer/sections/BenchmarkSection.tsx` change `register("benchmark.selicRate", ...)` to `register("benchmark.annualRate", ...)` (full rework next task), and in `web/lib/carteira-derive.ts` `yieldComparison` keep the signature but read `benchmarkTaxRate` as-is (it's a plain number prop — unaffected). Re-run `npx tsc --noEmit` until clean. Run the full unit suite: `npx vitest run` and fix any test fixture that builds a scenario with `benchmark: { selicRate: ... }` (e.g. mocks in page tests, `e2e/fixtures` is Playwright-only and can wait for Task 12).

- [ ] **Step 5.8: Commit**

```bash
git add web/lib/api-types.ts web/lib/defaults.ts web/components/scenario-drawer/schema.ts web/lib/store.ts web/tests/ web/components/scenario-drawer/sections/BenchmarkSection.tsx
git commit -m "feat(web): benchmark kind/annualRate types + store v4 migration"
```

---

### Task 6: Frontend — `BenchmarkSection` with CDI | Selic | IPCA+x% selector

**Files:**
- Rewrite: `web/components/scenario-drawer/sections/BenchmarkSection.tsx`
- Create: `web/tests/benchmark-section.test.tsx`

- [ ] **Step 6.1: Write the failing tests**

Create `web/tests/benchmark-section.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { BenchmarkSection } from "@/components/scenario-drawer/sections/BenchmarkSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

function Wrapper() {
  const form = useForm({ defaultValues: { benchmark: DEFAULT_SCENARIO.benchmark } });
  return (
    <FormProvider {...form}>
      <BenchmarkSection />
    </FormProvider>
  );
}

describe("BenchmarkSection", () => {
  it("renders the three kind options with CDI selected by default", () => {
    render(<Wrapper />);
    expect(screen.getByRole("radio", { name: "CDI" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Selic" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "IPCA + x%" })).toHaveAttribute("aria-checked", "false");
  });

  it("prefills the rate from macro for the selected kind", async () => {
    render(<Wrapper />);
    const rate = screen.getByLabelText(/Taxa anual/i) as HTMLInputElement;
    await waitFor(() => expect(Number(rate.value)).toBeCloseTo(0.149));
    fireEvent.click(screen.getByRole("radio", { name: "Selic" }));
    await waitFor(() => expect(Number(rate.value)).toBeCloseTo(0.15));
  });

  it("shows the spread field only for IPCA+x%", async () => {
    render(<Wrapper />);
    expect(screen.queryByLabelText(/Spread/i)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "IPCA + x%" }));
    expect(screen.getByLabelText(/Spread/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run to verify failure**

Run: `cd web && npx vitest run tests/benchmark-section.test.tsx`
Expected: FAIL — current component has no radios, no "Taxa anual" label

- [ ] **Step 6.3: Rewrite the component**

Replace the whole `web/components/scenario-drawer/sections/BenchmarkSection.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { useMacro } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { BenchmarkKind } from "@/lib/api-types";

const KIND_OPTIONS: Array<{ value: BenchmarkKind; label: string }> = [
  { value: "cdi", label: "CDI" },
  { value: "selic", label: "Selic" },
  { value: "ipca_plus", label: "IPCA + x%" },
];

export function BenchmarkSection() {
  const { register, setValue, watch } = useFormContext<ScenarioFormValues>();
  const macro = useMacro();
  const kind = watch("benchmark.kind");
  const ipcaSpread = watch("benchmark.ipcaSpread");

  // Prefill the nominal rate from live macro data whenever kind/spread change.
  // The field stays editable — a manual override holds until the next change.
  useEffect(() => {
    if (!macro.data) return;
    const base =
      kind === "cdi" ? macro.data.cdi :
      kind === "selic" ? macro.data.selic :
      macro.data.ipca + (ipcaSpread ?? 0);
    setValue("benchmark.annualRate", Number(base.toFixed(4)));
  }, [kind, ipcaSpread, macro.data, setValue]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Benchmark</h3>
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de benchmark">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={kind === opt.value}
            onClick={() => setValue("benchmark.kind", opt.value, { shouldDirty: true })}
            className={`px-3 py-1.5 rounded-pill text-[12px] font-medium border transition-colors ${
              kind === opt.value
                ? "bg-brand-bright/15 border-brand-bright/50 text-ink"
                : "bg-bg-2 border-line text-ink-2 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kind === "ipca_plus" && (
          <div className="space-y-1">
            <Label htmlFor="bench-spread" className="text-xs">Spread sobre IPCA</Label>
            <Input
              id="bench-spread"
              type="number"
              step="0.005"
              {...register("benchmark.ipcaSpread", { valueAsNumber: true })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="bench-rate" className="text-xs">Taxa anual (nominal)</Label>
          <Input
            id="bench-rate"
            type="number"
            step="0.0025"
            {...register("benchmark.annualRate", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bench-tax" className="text-xs">IR sobre rendimentos</Label>
          <Input
            id="bench-tax"
            type="number"
            step="0.005"
            {...register("benchmark.taxRate", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Run tests**

Run: `cd web && npx vitest run tests/benchmark-section.test.tsx && npx tsc --noEmit`
Expected: PASS / clean

- [ ] **Step 6.5: Commit**

```bash
git add web/components/scenario-drawer/sections/BenchmarkSection.tsx web/tests/benchmark-section.test.tsx
git commit -m "feat(web): benchmark kind selector with macro prefill in drawer"
```

---

### Task 7: Visão Geral — cards compare carteira vs benchmark

**Files:**
- Modify: `web/components/visao-geral/EvolutionCard.tsx:46-69`
- Modify: `web/components/visao-geral/MonthlyIncomeCard.tsx:23-33`
- Modify: `web/components/visao-geral/ComparativoTable.tsx:36`
- Test: `web/tests/evolution-card.test.tsx` (and any visão-geral page test the greps below hit)

- [ ] **Step 7.1: Update the failing tests first**

In `web/tests/evolution-card.test.tsx`, the mocked `SimulateOut`/MC fixtures keep their `realEstate` fields (the API still returns them in Fase 1). Change behavioral assertions: any assertion that the imóvel legend/series renders becomes its negation, e.g.:

```tsx
expect(screen.queryByText(/Imóvel/)).toBeNull();
```

and assert the benchmark legend is present (use the label string from the fixture, e.g. `screen.getByText("Tesouro Selic (líquido)")` or whatever the fixture's `benchmark.label` is).

Run: `cd web && npx vitest run tests/evolution-card.test.tsx`
Expected: FAIL (component still renders the imóvel series)

- [ ] **Step 7.2: `EvolutionCard.tsx` — drop the imóvel series and band**

Replace lines 46-69 with:

```tsx
  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: project(data.portfolio.patrimony) },
    { name: data.benchmark.label, color: data.benchmark.color, values: project(data.benchmark.patrimony) },
  ];

  // MC bands are annual-only — skip on monthly view to avoid showing flat
  // segments interpolated from 2 yearly percentiles.
  const bands = !isMonthly && mc.data
    ? [
        {
          name: `${mc.data.portfolio.label} p10–p90`,
          color: "rgba(39, 174, 96, 0.18)",
          lower: mc.data.portfolio.p10.slice(0, sliceN),
          upper: mc.data.portfolio.p90.slice(0, sliceN),
        },
      ]
    : undefined;
```

- [ ] **Step 7.3: `MonthlyIncomeCard.tsx` — benchmark instead of imóvel**

Replace lines 23-26:

```tsx
  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: data.portfolio.annualIncome.map((v) => v / 12) },
    { name: data.benchmark.label, color: data.benchmark.color, values: data.benchmark.annualIncome.map((v) => v / 12) },
  ];
```

and the footer text (line 33):

```tsx
      <p className="text-[11.5px] text-ink-3 mt-2">Carteira vs Benchmark · valor em R$/mês</p>
```

- [ ] **Step 7.4: `ComparativoTable.tsx` — swap the row source**

Line 36: `{[d.portfolio, d.realEstate].map((s) => {` → `{[d.portfolio, d.benchmark].map((s) => {`

- [ ] **Step 7.5: Run, then commit**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS / clean (fix any other visão-geral test asserting the imóvel row — `grep -rn "Imóvel" web/tests/`)

```bash
git add web/components/visao-geral/ web/tests/
git commit -m "feat(web): visão geral compares carteira vs benchmark"
```

---

### Task 8: Carteira — yield comparison vs benchmark

**Files:**
- Modify: `web/lib/carteira-derive.ts:1-2, 60-84`
- Modify: `web/components/carteira/YieldComparisonCard.tsx:6-16`
- Modify: `web/components/carteira/CarteiraPageContent.tsx:37-42`
- Test: `web/tests/carteira-derive.test.ts`

- [ ] **Step 8.1: Update the failing tests first**

In `web/tests/carteira-derive.test.ts`, replace the `yieldComparison` tests with:

```ts
import { yieldComparison, benchmarkNetYield, benchmarkLabel } from "@/lib/carteira-derive";
import type { BenchmarkInput } from "@/lib/api-types";

const CDI_BENCH: BenchmarkInput = { kind: "cdi", annualRate: 0.12, ipcaSpread: 0, taxRate: 0.175 };

describe("benchmarkNetYield / benchmarkLabel", () => {
  it("applies the tax rate to the nominal rate", () => {
    expect(benchmarkNetYield(CDI_BENCH)).toBeCloseTo(0.12 * 0.825);
  });

  it("labels each kind", () => {
    expect(benchmarkLabel(CDI_BENCH)).toBe("CDI líquido");
    expect(benchmarkLabel({ ...CDI_BENCH, kind: "selic" })).toBe("Selic líquido");
    expect(benchmarkLabel({ ...CDI_BENCH, kind: "ipca_plus", ipcaSpread: 0.06 })).toBe("IPCA + 6.0% líquido");
  });
});

describe("yieldComparison", () => {
  it("returns carteira rows plus the benchmark row, no imóvel", () => {
    const rows = yieldComparison({ pf: PF_FIXTURE, benchmark: CDI_BENCH });
    expect(rows.map((r) => r.label)).toEqual([
      "Carteira blended",
      "Carteira total (yield + ganho)",
      "CDI líquido",
    ]);
  });
});
```

(`PF_FIXTURE` = whatever `PortfolioInput` fixture the file already uses — reuse it.)

Run: `cd web && npx vitest run tests/carteira-derive.test.ts`
Expected: FAIL — exports don't exist yet

- [ ] **Step 8.2: Rework `web/lib/carteira-derive.ts`**

1. Replace lines 1-2 (remove the imovel-derive import — this unblocks Fase 2 deletion):

```ts
import type { PortfolioInput, BenchmarkInput, MacroOut } from "./api-types";
```

2. Replace the "Yield comparison" section (lines 58-84, types `YieldRow`/`RefLine` and `yieldComparison`/`yieldRefLines`) with:

```ts
// ---------- Yield comparison ----------

export type YieldRow = { label: string; value: number; color: string };

export function benchmarkNetYield(b: BenchmarkInput): number {
  return b.annualRate * (1 - b.taxRate);
}

export function benchmarkLabel(b: BenchmarkInput): string {
  if (b.kind === "cdi") return "CDI líquido";
  if (b.kind === "selic") return "Selic líquido";
  return `IPCA + ${(b.ipcaSpread * 100).toFixed(1)}% líquido`;
}

export function yieldComparison(args: {
  pf: PortfolioInput;
  benchmark: BenchmarkInput;
}): YieldRow[] {
  const { pf, benchmark } = args;
  return [
    { label: "Carteira blended",               value: blendedYield(pf),          color: "#46E8A4" },
    { label: "Carteira total (yield + ganho)", value: totalReturn(pf),           color: "#FFC857" },
    { label: benchmarkLabel(benchmark),        value: benchmarkNetYield(benchmark), color: "#5CC8FF" },
  ];
}

export type RefLine = { label: string; value: number };

export function yieldRefLines(macro: MacroOut): RefLine[] {
  return [
    { label: "Selic", value: macro.selic },
    { label: "IPCA",  value: macro.ipca },
  ];
}
```

- [ ] **Step 8.3: Update `YieldComparisonCard.tsx`**

Replace lines 6-16:

```tsx
import type { PortfolioInput, BenchmarkInput, MacroOut } from "@/lib/api-types";

type Props = {
  pf: PortfolioInput;
  benchmark: BenchmarkInput;
  macro: MacroOut;
};

export function YieldComparisonCard({ pf, benchmark, macro }: Props) {
  const rows = yieldComparison({ pf, benchmark });
  const refs = yieldRefLines(macro);
```

(rest of the component is untouched.)

- [ ] **Step 8.4: Update `CarteiraPageContent.tsx`**

Replace lines 37-42:

```tsx
      <YieldComparisonCard
        pf={scenario.portfolio}
        benchmark={scenario.benchmark}
        macro={macro.data!}
      />
```

- [ ] **Step 8.5: Run, then commit**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS / clean

```bash
git add web/lib/carteira-derive.ts web/components/carteira/ web/tests/carteira-derive.test.ts
git commit -m "feat(web): carteira yield comparison vs benchmark (drops imovel-derive import)"
```

---

### Task 9: Sensibilidade — portfolio tornado

**Files:**
- Modify: `web/components/sensibilidade/SensibilidadePageContent.tsx:29`
- Modify: `web/components/sensibilidade/KpiBaseCard.tsx:13`
- Test: `web/tests/sensibilidade-page.test.tsx`

- [ ] **Step 9.1: Update the failing test first**

In `web/tests/sensibilidade-page.test.tsx`: the base KPI assertion changes from the imóvel final patrimony to the **portfolio** final patrimony of the mocked fixture, and the KPI label assertion becomes `/Patrimônio Carteira ao fim de/`. Sensitivity row fixtures may keep old labels (the page renders whatever the API sends).

Run: `cd web && npx vitest run tests/sensibilidade-page.test.tsx`
Expected: FAIL

- [ ] **Step 9.2: Implement**

`SensibilidadePageContent.tsx` line 29:

```tsx
  const base = data.portfolio.patrimony[data.portfolio.patrimony.length - 1];
```

`KpiBaseCard.tsx` line 13:

```tsx
        label={`Patrimônio Carteira ao fim de ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
```

- [ ] **Step 9.3: Run, then commit**

Run: `cd web && npx vitest run tests/sensibilidade-page.test.tsx && npx tsc --noEmit`
Expected: PASS

```bash
git add web/components/sensibilidade/ web/tests/sensibilidade-page.test.tsx
git commit -m "feat(web): sensibilidade reads the portfolio tornado"
```

---

### Task 10: Risco — portfolio MC + benchmark overlay

**Files:**
- Modify: `web/lib/risco-derive.ts:84-108` (`LossRateInfo`, `lossRateInfo`)
- Modify: `web/components/risco/RiscoPageContent.tsx`
- Modify: `web/components/risco/KpiRowRisco.tsx`
- Modify: `web/components/risco/MCBandCard.tsx`
- Modify: `web/components/risco/DistributionCard.tsx`
- Test: `web/tests/risco-derive.test.ts`, `web/tests/risco-page.test.tsx`

- [ ] **Step 10.1: Update the failing derive test first**

In `web/tests/risco-derive.test.ts`, replace `lossRateInfo` tests with:

```ts
describe("lossRateInfo (portfolio-only)", () => {
  it("flags the portfolio above the threshold", () => {
    const info = lossRateInfo({ portfolioRate: 0.10 });
    expect(info.show).toBe(true);
    expect(info.flagged).toEqual([{ label: "Carteira", rate: 0.10 }]);
  });

  it("stays hidden below the threshold", () => {
    const info = lossRateInfo({ portfolioRate: 0.01 });
    expect(info.show).toBe(false);
    expect(info.flagged).toEqual([]);
  });
});
```

Run: `cd web && npx vitest run tests/risco-derive.test.ts` — Expected: FAIL

- [ ] **Step 10.2: Rework `lossRateInfo` in `web/lib/risco-derive.ts`**

Replace lines 84-108:

```ts
// ---------- Loss rate banner ----------

export type LossRateInfo = {
  show: boolean;
  portfolioRate: number;
  flagged: Array<{ label: string; rate: number }>;
};

export function lossRateInfo(args: {
  portfolioRate: number;
  threshold?: number;
}): LossRateInfo {
  const threshold = args.threshold ?? LOSS_RATE_WARNING;
  const flagged: Array<{ label: string; rate: number }> = [];
  if (args.portfolioRate > threshold) flagged.push({ label: "Carteira", rate: args.portfolioRate });
  return {
    show: flagged.length > 0,
    portfolioRate: args.portfolioRate,
    flagged,
  };
}
```

(`LossRateBanner.tsx` only consumes `info.show`/`info.flagged` — no change needed.)

- [ ] **Step 10.3: Rework `MCBandCard.tsx`**

Replace the props and series/bands (lines 6-33):

```tsx
import type { MonteCarloResultOut, SimulationResultOut } from "@/lib/api-types";

type Props = {
  portfolio:  MonteCarloResultOut;
  benchmark:  SimulationResultOut;
  years:      number[];
  nTrajectories: number;
};

export function MCBandCard({ portfolio, benchmark, years, nTrajectories }: Props) {
  const series = [
    { name: `${portfolio.label} p50`, color: portfolio.color, values: portfolio.p50, width: 2 },
    { name: benchmark.label, color: benchmark.color, values: benchmark.patrimony, width: 2 },
  ];
  const bands = [
    {
      name: `${portfolio.label} p10–p90`,
      color: "rgba(39, 174, 96, 0.18)",
      lower: portfolio.p10,
      upper: portfolio.p90,
    },
  ];
```

and the footnote (line 53-55):

```tsx
        <p className="text-[10px] text-ink-4 mt-3">
          Linha verde = p50 (mediano); sombra = intervalo p10–p90 (80% das trajetórias); linha amarela = benchmark determinístico. Seed fixa.
        </p>
```

- [ ] **Step 10.4: Rework `DistributionCard.tsx` (portfolio-only)**

Replace the whole component body:

```tsx
type Props = {
  portfolio: MonteCarloResultOut;
  target: number;
};

export function DistributionCard({ portfolio, target }: Props) {
  const pfP = distributionPercentiles(portfolio.finalDistribution);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Distribuição final do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <p className="text-[12px] font-medium text-ink mb-2">{portfolio.label}</p>
        <Histogram
          values={portfolio.finalDistribution}
          color={portfolio.color}
          percentiles={pfP}
          target={target}
        />
        <p className="text-[10px] text-ink-4 mt-3">
          Cada barra agrupa trajetórias com patrimônio final no intervalo. Linhas tracejadas = p10/p50/p90;
          linha sólida amarela = meta (se setada).
        </p>
      </CardContent>
    </Card>
  );
}
```

(imports: drop nothing — `MonteCarloResultOut` is still used.)

- [ ] **Step 10.5: Rework `KpiRowRisco.tsx`**

Replace props and subs:

```tsx
type Props = {
  pfStats: RiskStats;
  benchmarkFinal: number;
  hasTarget: boolean;
};

export function KpiRowRisco({ pfStats, benchmarkFinal, hasTarget }: Props) {
  const probMetaValue = hasTarget ? formatPercent(pfStats.probTarget!, 1) : "—";
  const probMetaSub = hasTarget ? "trajetórias acima da meta" : "configure meta no Drawer";
  const probMetaColor = hasTarget && pfStats.probTarget! >= 0.7 ? "green" : "default";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
        sub={`Benchmark: ${formatRsK(benchmarkFinal)}`}
        icon={BarChart3}
      />
      <KpiCard
        label="Pior cenário (p10)"
        value={formatRsK(pfStats.finalP10)}
        sub="10% das trajetórias abaixo"
        icon={TrendingDown}
      />
      <KpiCard
        label="Drawdown médio máx."
        value={formatPercent(pfStats.meanMaxDrawdown, 1)}
        sub="média dos máximos por trajetória"
        icon={Activity}
        valueColor="red"
      />
    </div>
  );
}
```

- [ ] **Step 10.6: Rework `RiscoPageContent.tsx`**

Replace lines 41-65:

```tsx
  const data = mc.data!;
  const benchmark = sim.data!.benchmark;
  const years = sim.data!.portfolio.years;
  const pfStats = riskStats({ result: data.portfolio, target, capitalInitial: capital });
  const lossInfo = lossRateInfo({ portfolioRate: pfStats.lossRate });
  const benchmarkFinal = benchmark.patrimony[benchmark.patrimony.length - 1];

  return (
    <div className="space-y-6">
      <LossRateBanner info={lossInfo} capitalInitial={capital} />
      <KpiRowRisco pfStats={pfStats} benchmarkFinal={benchmarkFinal} hasTarget={target > 0} />
      <MCBandCard
        portfolio={data.portfolio}
        benchmark={benchmark}
        years={years}
        nTrajectories={nTrajectories}
      />
      <DistributionCard portfolio={data.portfolio} target={target} />
    </div>
  );
```

- [ ] **Step 10.7: Update `web/tests/risco-page.test.tsx`**

Fixtures keep `realEstate` in the MC mock (API still returns it). Assertions that imóvel KPIs/series render become negations (`expect(screen.queryByText(/Imóvel/)).toBeNull()`), and add an assertion that the benchmark label from the simulate fixture renders.

- [ ] **Step 10.8: Run, then commit**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS / clean

```bash
git add web/lib/risco-derive.ts web/components/risco/ web/tests/
git commit -m "feat(web): risco page is portfolio MC + benchmark overlay"
```

---

### Task 11: Tributação — carteira vs benchmark

**Files:**
- Modify: `web/lib/tributacao-derive.ts`
- Modify: `web/components/tributacao/TributacaoPageContent.tsx`
- Modify: `web/components/tributacao/KpiRowTributacao.tsx`
- Modify: `web/components/tributacao/TaxComparisonChart.tsx`
- Modify: `web/components/tributacao/TributacaoTable.tsx:10-13`
- Test: `web/tests/tributacao-derive.test.ts`, `web/tests/tributacao-page.test.tsx`

- [ ] **Step 11.1: Update the failing derive tests first**

In `web/tests/tributacao-derive.test.ts`:

```ts
import { splitTaxRows, taxDelta } from "@/lib/tributacao-derive";
import type { TaxComparisonRowOut } from "@/lib/api-types";

const PF_ROW: TaxComparisonRowOut = {
  scenario: "Carteira Diversificada", grossIncome: 10_000, annualTax: 2_000,
  netIncome: 8_000, effectiveTaxBurden: 0.20,
};
const BENCH_ROW: TaxComparisonRowOut = {
  scenario: "CDI (líquido)", grossIncome: 12_000, annualTax: 2_100,
  netIncome: 9_900, effectiveTaxBurden: 0.175,
};

describe("splitTaxRows", () => {
  it("splits into portfolio and benchmark", () => {
    const { portfolio, benchmark } = splitTaxRows([PF_ROW, BENCH_ROW]);
    expect(portfolio).toEqual(PF_ROW);
    expect(benchmark).toEqual(BENCH_ROW);
  });

  it("returns nulls when rows are missing", () => {
    expect(splitTaxRows([])).toEqual({ portfolio: null, benchmark: null });
  });
});

describe("taxDelta", () => {
  it("computes portfolio − benchmark", () => {
    const d = taxDelta(PF_ROW, BENCH_ROW);
    expect(d.taxDiffAbs).toBeCloseTo(-100);
    expect(d.burdenDiffPp).toBeCloseTo(0.025);
    expect(d.portfolioPaysMore).toBe(false);
  });
});
```

Run: `cd web && npx vitest run tests/tributacao-derive.test.ts` — Expected: FAIL

- [ ] **Step 11.2: Rework `web/lib/tributacao-derive.ts`**

Replace lines 1-44:

```ts
import type { TaxComparisonRowOut } from "./api-types";

const PORTFOLIO_SCENARIO = "Carteira Diversificada";

export function splitTaxRows(rows: TaxComparisonRowOut[]): {
  portfolio: TaxComparisonRowOut | null;
  benchmark: TaxComparisonRowOut | null;
} {
  return {
    portfolio: rows.find((r) => r.scenario === PORTFOLIO_SCENARIO) ?? null,
    benchmark: rows.find((r) => r.scenario !== PORTFOLIO_SCENARIO) ?? null,
  };
}

export type TaxDelta = {
  taxDiffAbs:        number;  // portfolio − benchmark
  burdenDiffPp:      number;
  portfolioPaysMore: boolean;
};

export function taxDelta(
  pf: TaxComparisonRowOut,
  bench: TaxComparisonRowOut,
): TaxDelta {
  const taxDiffAbs   = pf.annualTax - bench.annualTax;
  const burdenDiffPp = pf.effectiveTaxBurden - bench.effectiveTaxBurden;
  return {
    taxDiffAbs,
    burdenDiffPp,
    portfolioPaysMore: taxDiffAbs > 0,
  };
}

export const SCENARIO_COLORS = {
  benchmark: "#5CC8FF",
  portfolio: "#46E8A4",
  tax:       "#FF5D72",
} as const;
```

In `TAX_NOTES` (lines 46-67), delete the `"Aluguel (PF)"` entry; keep the other four.

- [ ] **Step 11.3: Rework `KpiRowTributacao.tsx`**

Replace the whole component:

```tsx
"use client";

import { Receipt, Wallet, Percent, Scale } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { taxDelta } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  portfolio: TaxComparisonRowOut;
  benchmark: TaxComparisonRowOut;
};

export function KpiRowTributacao({ portfolio, benchmark }: Props) {
  const delta = taxDelta(portfolio, benchmark);
  const absDiff = Math.abs(delta.taxDiffAbs);
  const absBurden = Math.abs(delta.burdenDiffPp);
  const subDelta = delta.portfolioPaysMore
    ? `Carteira paga +${formatPercent(absBurden, 2)} a mais`
    : `Benchmark paga +${formatPercent(absBurden, 2)} a mais`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Imposto Carteira"
        value={formatRs(portfolio.annualTax)}
        icon={Wallet}
        valueColor="green"
        sub="anual"
      />
      <KpiCard
        label="Imposto Benchmark"
        value={formatRs(benchmark.annualTax)}
        icon={Receipt}
        valueColor="red"
        sub="anual"
      />
      <KpiCard
        label="Carga efetiva Carteira"
        value={formatPercent(portfolio.effectiveTaxBurden, 2)}
        icon={Percent}
        sub={`${formatPercent(benchmark.effectiveTaxBurden, 2)} benchmark`}
      />
      <KpiCard
        label="Diferença"
        value={formatRs(absDiff)}
        icon={Scale}
        feature
        valueColor={delta.portfolioPaysMore ? "red" : "green"}
        sub={subDelta}
      />
    </div>
  );
}
```

- [ ] **Step 11.4: Rework `TaxComparisonChart.tsx`**

Change props/rows (lines 8-30) — the SVG body is untouched:

```tsx
type Props = {
  portfolio: TaxComparisonRowOut;
  benchmark: TaxComparisonRowOut;
};
```

```tsx
export function TaxComparisonChart({ portfolio, benchmark }: Props) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const maxGross = Math.max(portfolio.grossIncome, benchmark.grossIncome, 1);

  const rows = [
    { label: "Carteira",  row: portfolio, color: SCENARIO_COLORS.portfolio },
    { label: "Benchmark", row: benchmark, color: SCENARIO_COLORS.benchmark },
  ];
```

And the legend block (lines 110-123):

```tsx
        <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.portfolio }} />
            Líquido Carteira
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.benchmark }} />
            Líquido Benchmark
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SCENARIO_COLORS.tax }} />
            Imposto
          </span>
        </div>
```

- [ ] **Step 11.5: `TributacaoTable.tsx` bullet color**

Replace lines 10-13:

```tsx
function bulletColor(scenario: string): string {
  if (scenario === "Carteira Diversificada") return SCENARIO_COLORS.portfolio;
  return SCENARIO_COLORS.benchmark;
}
```

- [ ] **Step 11.6: `TributacaoPageContent.tsx` wiring**

Replace lines 30-39:

```tsx
  const { portfolio, benchmark } = splitTaxRows(data.taxComparison);

  if (!portfolio || !benchmark) {
    return <ErrorCard message="Dados de tributação incompletos" onRetry={() => sim.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <KpiRowTributacao portfolio={portfolio} benchmark={benchmark} />
      <TaxComparisonChart portfolio={portfolio} benchmark={benchmark} />
```

- [ ] **Step 11.7: Update `web/tests/tributacao-page.test.tsx` fixtures**

The mocked `taxComparison` rows become `"Carteira Diversificada"` + `"CDI (líquido)"` (the API no longer sends an "Imóvel" row after Task 3/4). Assertions move from "Imposto Imóvel" to "Imposto Carteira" / "Imposto Benchmark".

- [ ] **Step 11.8: Run, then commit**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS / clean

```bash
git add web/lib/tributacao-derive.ts web/components/tributacao/ web/tests/
git commit -m "feat(web): tributação compares carteira vs benchmark"
```

---

### Task 12: Fase 1 finale — exportar, Topbar subtitle, e2e fixtures, full verification

**Files:**
- Modify: `web/lib/exportar-csv.ts:24, 52-54`
- Modify: `web/components/shell/Topbar.tsx:73-75`
- Modify: `web/e2e/fixtures/api-mocks.ts`
- Test: `web/tests/exportar-csv.test.ts`, `web/tests/Topbar.test.tsx`

- [ ] **Step 12.1: Update failing exportar tests first**

In `web/tests/exportar-csv.test.ts`:
- `csvFilename` block becomes:

```ts
describe("exportar-csv — csvFilename", () => {
  it("formato 'simulacao_investa_{N}anos.csv'", () => {
    expect(csvFilename(10)).toBe("simulacao_investa_10anos.csv");
    expect(csvFilename(1)).toBe("simulacao_investa_1anos.csv");
    expect(csvFilename(30)).toBe("simulacao_investa_30anos.csv");
  });
});
```

- `buildLongFormatRows` tests: rows now contain only portfolio + benchmark scenarios (fixture keeps its `realEstate` field; assert its label does NOT appear in the rows).

Run: `cd web && npx vitest run tests/exportar-csv.test.ts` — Expected: FAIL

- [ ] **Step 12.2: Implement exportar changes**

In `web/lib/exportar-csv.ts` delete line 24 (`append(sim.realEstate);`) and replace `csvFilename`:

```ts
export function csvFilename(horizonYears: number): string {
  return `simulacao_investa_${horizonYears}anos.csv`;
}
```

- [ ] **Step 12.3: Topbar subtitle**

In `web/components/shell/Topbar.tsx`, add inside the component (after the `setDrawerOpen` line):

```tsx
  const horizon = useScenarioStore((s) => s.scenario.horizon);
```

and replace line 73-75:

```tsx
        <p className="text-[12.5px] text-ink-3 leading-tight truncate">
          Análise · Carteira vs Benchmark · {horizon} anos
        </p>
```

Add to `web/tests/Topbar.test.tsx`:

```tsx
  it("subtitle shows carteira vs benchmark with the scenario horizon", () => {
    render(<Topbar />);
    expect(screen.getByText(/Carteira vs Benchmark · 10 anos/)).toBeInTheDocument();
  });
```

(Default scenario horizon is 10; the store is not persisted in jsdom so the default applies.)

- [ ] **Step 12.4: e2e fixtures + specs**

In `web/e2e/fixtures/api-mocks.ts`: response shapes are unchanged in Fase 1 (the API still returns `realEstate`), but grep for input-shaped fixtures: `grep -n "selicRate" web/e2e/fixtures/api-mocks.ts web/e2e/*.spec.ts` → replace with the new `{ kind, annualRate, ipcaSpread, taxRate }` shape. Also `grep -n "imovel\|Imóvel" web/e2e/*.spec.ts` — update any assertion that visão-geral/risco/tributação shows imóvel content (e.g. legend text) to the benchmark equivalent; `exportar.spec.ts` filename assertion → `simulacao_investa_10anos.csv`.

- [ ] **Step 12.5: Full Fase 1 verification**

```bash
cd api && python -m pytest -q
cd ../web && npx vitest run && npx tsc --noEmit && npm run lint
npx playwright test
```

Expected: all green. Manual smoke (optional but recommended): `npm run dev`, open the drawer, switch CDI→IPCA+x%, apply, confirm all six pages render benchmark series.

- [ ] **Step 12.6: Commit**

```bash
git add web/
git commit -m "feat(web): exportar/topbar rebrand + e2e fixtures — fase 1 complete"
```

---

# FASE 2 — Deleção do imóvel

### Task 13: Web — delete everything imóvel

After Fase 1 no page renders imóvel data, so this is mechanical. The frontend tests are API-mocked, so web can land before the API deletion (pydantic ignores the extra `realEstate` key it keeps receiving until Task 14… actually it won't even receive it after this task — and the Fase-1 API still tolerates its absence only after Task 14, so run e2e with mocks, not against the live API, until Task 14 lands).

**Files:**
- Delete: `web/app/imovel/`, `web/components/imovel/`, `web/lib/imovel-derive.ts`, `web/components/scenario-drawer/sections/RealEstateSection.tsx`, `web/components/scenario-drawer/sections/FinancingSection.tsx`, `web/tests/imovel-derive.test.ts`, `web/tests/imovel-page.test.tsx`, `web/tests/financing-section.test.tsx`
- Modify: `web/lib/nav.ts`, `web/components/scenario-drawer/ScenarioDrawer.tsx`, `web/components/scenario-drawer/schema.ts`, `web/lib/api-types.ts`, `web/lib/defaults.ts`, `web/lib/api.ts`, `web/lib/store.ts`, `web/e2e/fixtures/api-mocks.ts`, remaining tests

- [ ] **Step 13.1: Delete files**

```bash
cd /home/lucgomes/workspace/investa
git rm -r web/app/imovel web/components/imovel web/lib/imovel-derive.ts \
  web/components/scenario-drawer/sections/RealEstateSection.tsx \
  web/components/scenario-drawer/sections/FinancingSection.tsx \
  web/tests/imovel-derive.test.ts web/tests/imovel-page.test.tsx \
  web/tests/financing-section.test.tsx
```

- [ ] **Step 13.2: `web/lib/nav.ts`** — remove line 31 (`{ slug: "imovel", ... }`) and the now-unused `Home` import from the lucide block.

- [ ] **Step 13.3: `web/components/scenario-drawer/ScenarioDrawer.tsx`** — remove the `RealEstateSection`/`FinancingSection` imports (lines 11-12) and their two JSX usages (lines 53-54).

- [ ] **Step 13.4: `web/components/scenario-drawer/schema.ts`** — delete `financingSchema` (lines 3-9) and `realEstateSchema` (lines 11-24); remove `realEstate: realEstateSchema,` from `scenarioFormSchema`.

- [ ] **Step 13.5: `web/lib/api-types.ts`** — delete `FinancingInput` (lines 4-10) and `RealEstateInput` (lines 12-25); remove `realEstate: RealEstateInput;` from `SimulateInput` and `SimulateMonteCarloInput`; remove `realEstate: SimulationResultOut;` from `SimulateOut`; remove `realEstate: MonteCarloResultOut;` from `SimulateMonteCarloOut`.

- [ ] **Step 13.6: `web/lib/defaults.ts`** — remove the `FinancingInput` import (line 1 becomes `import type { SimulateInput, MonteCarloInput } from "./api-types";`); delete the whole `realEstate: {...}` block from `DEFAULT_SCENARIO` (lines 7-20) and the `DEFAULT_FINANCING` export (lines 49-55). `grep -rn "DEFAULT_FINANCING" web/` must come back empty after the deletions.

- [ ] **Step 13.7: `web/lib/api.ts`** — in `useMonteCarlo` remove `realEstate: scenario.realEstate,` from the payload (line 61).

- [ ] **Step 13.8: Store v5 migration**

In `web/lib/store.ts` bump `version: 4` → `version: 5`, update the comment, and extend `migrate`:

```ts
      // v4: benchmark reshaped from {selicRate,taxRate} to {kind,annualRate,ipcaSpread,taxRate}.
      // v5: realEstate dropped from the persisted scenario (imóvel removed from the product).
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          scenario?: SimulateInput & {
            benchmark?: Partial<SimulateInput["benchmark"]> & { selicRate?: number };
            realEstate?: unknown;
          };
        };
        if ((version ?? 0) < 4 && state?.scenario) {
          const old = state.scenario.benchmark ?? {};
          state.scenario.benchmark = {
            kind: "selic",  // pre-v4 benchmark was Tesouro Selic — preserve intent
            annualRate: old.selicRate ?? DEFAULT_SCENARIO.benchmark.annualRate,
            ipcaSpread: 0,
            taxRate: old.taxRate ?? 0.175,
          };
        }
        if ((version ?? 0) < 5 && state?.scenario) {
          delete state.scenario.realEstate;
        }
        return state;
      },
```

Add to `web/tests/store-migration.test.ts` (the v3 payload already contains `realEstate`):

```ts
  it("v5 drops realEstate from the persisted scenario", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect("realEstate" in s.scenario).toBe(false);
  });
```

- [ ] **Step 13.9: Scrub remaining web tests and e2e fixtures**

```bash
grep -rln "realEstate\|RealEstate\|imovel\|Imóvel" web/tests/ web/e2e/ web/lib/ web/components/ web/app/
```

For each hit:
- `web/e2e/fixtures/api-mocks.ts`: delete the `realEstate` objects from the mocked `/api/simulate` and `/api/simulate/monte-carlo` responses.
- `web/tests/api-types.test.ts`, `web/tests/goal-card.test.tsx`, `web/tests/evolution-card.test.tsx`, `web/tests/risco-page.test.tsx`, `web/tests/exportar-*.test.ts(x)`, `web/tests/nav.test.ts`, `web/tests/Sidebar.test.tsx`: remove `realEstate` from scenario/response fixtures, drop "Imóvel" nav-item expectations (item count decreases by 1).
- `web/e2e/smoke.spec.ts` (and any spec visiting `/imovel`): remove that navigation.

The negation assertions added in Fase 1 (`queryByText(/Imóvel/)`) still pass — keep them.

- [ ] **Step 13.10: Run, then commit**

Run: `cd web && npx vitest run && npx tsc --noEmit && npm run lint && npx playwright test`
Expected: all green (e2e is fully mocked)

```bash
git add -A web/
git commit -m "refactor(web)!: remove imóvel (route, components, types, store v5)"
```

---

### Task 14: API — delete real estate end to end

**Files:**
- Modify: `api/core/models.py`, `api/core/config.py`, `api/schemas/inputs.py`, `api/schemas/outputs.py`, `api/routers/simulation.py`, `api/routers/portfolio.py`
- Delete: `api/tests/test_financing.py`
- Modify: remaining `api/tests/*`

- [ ] **Step 14.1: `api/schemas/inputs.py`** — delete `FinancingInput` (lines 29-34) and `RealEstateInput` (lines 37-49); remove `real_estate: RealEstateInput` from `SimulateInput` and `SimulateMonteCarloInput`.

- [ ] **Step 14.2: `api/schemas/outputs.py`** — remove `real_estate: SimulationResultOut` from `SimulateOut` (line 60), `real_estate: MonteCarloResultOut` from `SimulateMonteCarloOut` (line 78), and `real_estate: dict` from `PortfolioDefaultsOut` (line 100).

- [ ] **Step 14.3: `api/routers/simulation.py`**

- Imports: remove `FinancingParams`, `RealEstateParams` from `core.config`; remove `simulate_real_estate`, `simulate_real_estate_mc` from `core.models`.
- Delete `_to_real_estate_params` entirely.
- In `simulate()`: delete the `re_params = ...` line, the whole `re_result = simulate_real_estate(...)` call, and `real_estate=simulation_result_to_dto(re_result),` from the `SimulateOut(...)` return.
- In `simulate_monte_carlo()`: delete `re_params = ...`, the whole `re_mc = simulate_real_estate_mc(...)` call, and `real_estate=monte_carlo_result_to_dto(re_mc),` from the return.

- [ ] **Step 14.4: `api/routers/portfolio.py`** — remove `RealEstateParams` from the import; delete `re_defaults = asdict(RealEstateParams())` and the `"realEstate": _camel_dict(re_defaults),` entry. Docstring: `"""Return the default scenario (Portfolio + Benchmark) for first load."""`

- [ ] **Step 14.5: `api/core/models.py`** — delete the functions `simulate_real_estate`, `_simulate_real_estate_cash`, `_simulate_real_estate_financed` (whole block, lines ~253-405), `simulate_real_estate_mc` and its helpers `_simulate_real_estate_mc_cash`/`_simulate_real_estate_mc_financed` (lines ~406-592), and `sensitivity_real_estate` (lines ~754-799). Then fix the imports at the top of the file: remove `FinancingParams`, `RealEstateParams` from the `core.config` import. `compute_irpf_carne_leao` (line 800) survives only if something still uses it — `grep -rn "compute_irpf_carne_leao" api/ | grep -v test` → if only tests reference it, delete it and its tests too.

- [ ] **Step 14.6: `api/core/config.py`** — delete the `FinancingParams` and `RealEstateParams` dataclasses (the whole real-estate section, lines ~46-116, up to but not including the "Portfolio defaults" header). Keep `SELIC_RATE` (used by `MacroDefaults` and `BenchmarkParams`).

- [ ] **Step 14.7: Scrub API tests**

```bash
git rm api/tests/test_financing.py
grep -rln "real_estate\|realEstate\|RealEstate\|simulate_real_estate\|sensitivity_real_estate" api/
```

For each remaining hit in `api/tests/`:
- `test_models.py`: delete the real-estate test classes/functions (lines ~112-180 plus any others the grep shows).
- `test_monte_carlo.py`: delete the RE MC tests (lines ~134-183).
- `test_endpoint_simulate.py`, `test_endpoint_monte_carlo.py`, `test_integration.py`, `conftest.py`: remove `realEstate` from request payload fixtures and `real_estate`/`realEstate` keys from response assertions (`SimulateMonteCarloOut` now has only `portfolio`).
- `test_schemas_inputs.py`: delete `FinancingInput`/`RealEstateInput` validation tests; `SimulateInput` fixtures lose `realEstate`.
- `test_endpoint_portfolio.py`: defaults response no longer has `realEstate`.
- `test_converters.py`: drop RE-shaped fixtures if present.

The final grep over `api/` must return zero hits outside `docs/`.

- [ ] **Step 14.8: Run, then commit**

Run: `cd api && python -m pytest -q`
Expected: PASS

```bash
git add -A api/
git commit -m "refactor(api)!: remove real estate simulation (~600 LOC)"
```

---

### Task 15: Final sweep, full verification, docs

- [ ] **Step 15.1: Repo-wide sweep**

```bash
cd /home/lucgomes/workspace/investa
grep -rni "imovel\|imóvel\|real.estate\|realestate" --include="*.py" --include="*.ts" --include="*.tsx" api/ web/ | grep -v node_modules
```

Expected: zero hits (negation test assertions like `queryByText(/Imóvel/)` are acceptable leftovers — keep them; everything else gets fixed).

Also check user-facing copy: `grep -rni "imóvel" web/app/ web/components/ README.md` and update any page descriptions/metadata that still describe the product as "imóvel vs carteira".

- [ ] **Step 15.2: Full verification, both stacks**

```bash
cd api && python -m pytest -q
cd ../web && npx vitest run && npx tsc --noEmit && npm run lint && npx playwright test && npm run build
```

Expected: all green, production build succeeds.

- [ ] **Step 15.3: Mark the spec as executed**

In `docs/superpowers/specs/2026-06-10-remove-imovel-design.md` change `**Status:** Approved` to `**Status:** Implemented`.

- [ ] **Step 15.4: Final commit**

```bash
git add docs/
git commit -m "docs: mark remove-imovel spec as implemented"
```

Then use superpowers:finishing-a-development-branch to decide merge/PR. Reminder: the API (Render) and web (Vercel) must deploy together after merge — the Fase 2 API rejects nothing (extra JSON keys are ignored), but the new web sends the new benchmark shape, which the old API rejects (`selic_rate` missing). Deploy API first, then web.

---

## Self-review notes (already applied)

- Spec coverage: benchmark generalization (T1), fairness/aportes (T1), sensitivity_portfolio (T2), tax comparison (T3), schema/router (T4), types/defaults/store v4 (T5), drawer selector (T6), six page migrations (T7-T12), deletion web (T13), deletion API (T14), docs/identity (T12, T15). Store v5 (T13.8). All spec sections have tasks.
- Fase 1 keeps `real_estate` flowing through `/simulate` and `/simulate/monte-carlo` so `/imovel` keeps working until Fase 2 — only the *shared* pages migrate.
- `_build_sensitivity_deltas` dies in Task 4 (unused), `sensitivity_real_estate` itself only in Task 14 (it's still imported by nothing after T4 — but its tests live until T14; if `pytest` flags an unused import in the router after T4, that's exactly the cleanup T4 step 4 performs).
- Type consistency check: `BenchmarkInput = { kind, annualRate, ipcaSpread, taxRate }` used identically in T4 (Pydantic), T5 (TS), T6 (form), T8 (derive). `lossRateInfo({ portfolioRate })` in T10 matches its test. `splitTaxRows → { portfolio, benchmark }` in T11 consistent across derive/page/tests.
