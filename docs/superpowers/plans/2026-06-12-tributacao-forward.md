# Tributação Forward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tax-aware simulation engine (profiles: deferral, come-cotas, regressive-per-tranche, exemptions, WHT) with net-of-redemption patrimony, a forward Tributação page, and LCI×CDB / PGBL×VGBL comparators.

**Architecture:** One unified per-class accumulation core (`_simulate_taxed_classes`) drives BOTH the deterministic path (N=1, σ=0) and Monte Carlo (N trajectories) — value/basis per class, deterministic tranche schedule for regressive exit tax, annual events (WHT/come-cotas/anual). `patrimony` becomes net-of-redemption everywhere (invariant `net = gross − exit_tax`). The benchmark reuses the same core as a single `rf_regressiva` class. Fase B consumes the new `taxProjection` payload in a rebuilt Tributação page plus two pure comparator libs.

**Tech Stack:** numpy/FastAPI/Pydantic v2; Next.js 14 + TS strict + zustand (v7 migration) + vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-06-12-tributacao-forward-design.md` (Approved). **One spec amendment encoded here** (Task 12 edits the spec): the `tributado_anual` byte-identical regression pin holds for SINGLE-class portfolios; multi-class portfolios change behavior — the old engine's blended rate implicitly REBALANCED annually, the new engine is buy-and-hold per class (weights drift). Rebalancing is a taxable event; modeling it untaxed would be wrong, taxed is approach-C complexity. Buy-and-hold is the deferral-consistent choice.

**Repo:** `/home/lucgomes/workspace/investa`, branch `feat/tributacao-forward` (stacked on `feat/reais-de-hoje`). API: `cd api && .venv/bin/python -m pytest -q` (145 passed, 1 skipped). Web: `cd web && npx vitest run` (520), `npx tsc --noEmit`, `npm run lint`, `npx playwright test` (17).

**Behavior changes shipped by Fase A (intentional, listed for reviewers):**
1. `patrimony` = net-of-redemption (was: market value with annual-haircut taxes).
2. Multi-class portfolios are buy-and-hold (weights drift; no implicit annual rebalance).
3. `reinvest_income=False` now means "distributed yields are not reinvested" (accrual profiles keep accruing); the old `rate=capital_gain-only` semantics is gone.
4. RF/benchmark values rise (deferral); benchmark IR field leaves the drawer (regressiva automática).
5. Sensitivity "IR efetivo (±5pp)" row → "Horizonte (−2a / +2a)".

---

# FASE A — Motor e API

### Task 1: Config + schemas — `TaxProfile`, constants, `tax_profile` field

**Files:**
- Modify: `api/core/config.py` (constants near the top; `AssetClass`; default assets in `PortfolioParams`)
- Modify: `api/schemas/inputs.py` (`PortfolioAssetInput`)
- Test: `api/tests/test_schemas_inputs.py` (extend)

- [ ] **Step 1.1: Failing schema tests**

Append to `api/tests/test_schemas_inputs.py`:

```python
def test_asset_input_accepts_tax_profile():
    a = PortfolioAssetInput.model_validate({
        "name": "CDB", "weight": 1.0, "expectedYield": 0.12,
        "taxProfile": "rf_regressiva",
    })
    assert a.tax_profile == "rf_regressiva"


def test_asset_input_tax_profile_defaults_to_tributado_anual():
    a = PortfolioAssetInput.model_validate({
        "name": "X", "weight": 1.0, "expectedYield": 0.10,
    })
    assert a.tax_profile == "tributado_anual"


def test_asset_input_rejects_unknown_profile():
    with pytest.raises(ValidationError):
        PortfolioAssetInput.model_validate({
            "name": "X", "weight": 1.0, "expectedYield": 0.10,
            "taxProfile": "isento_total",
        })
```

Run: `cd api && .venv/bin/python -m pytest tests/test_schemas_inputs.py -v -k profile` — FAIL.

- [ ] **Step 1.2: config.py**

Near the top of `api/core/config.py` (after the existing `Final` imports/constants — `Literal` and `Final` are already imported in this file; verify):

```python
# ---------- Tax profiles (tributação forward) ----------

TaxProfile = Literal[
    "isento", "fii", "acoes_br", "rf_regressiva",
    "come_cotas", "dividendos_exterior", "tributado_anual",
]

# Exit tax on accumulated GAIN at redemption, by profile.
EXIT_GAIN_RATE: Final[dict[str, float]] = {
    "fii": 0.20,
    "acoes_br": 0.15,
    "dividendos_exterior": 0.15,
}

WHT_DIVIDENDOS_EXTERIOR: Final[float] = 0.30
COME_COTAS_RATE: Final[float] = 0.15


def regressive_rate(holding_years: int) -> float:
    """Annual-resolution regressive IR bracket.

    Begin-of-year tranches redeemed at year-end hold >= 1 year, so only the
    17,5% (1 year) and 15% (>= 2 years) brackets are reachable.
    """
    return 0.15 if holding_years >= 2 else 0.175
```

`AssetClass` gains (after `volatility`):

```python
    tax_profile: str = "tributado_anual"   # TaxProfile; tax_rate only used by this fallback
```

Default assets in `PortfolioParams` gain profiles (FIIs→`"fii"`, Ações BR→`"acoes_br"`, Aristocrats US→`"dividendos_exterior"`, Tesouro/LCI→`"rf_regressiva"`) — add `tax_profile="..."` kwargs to each `AssetClass(...)` literal.

- [ ] **Step 1.3: schemas**

`api/schemas/inputs.py` — `PortfolioAssetInput` gains:

```python
    tax_profile: Literal[
        "isento", "fii", "acoes_br", "rf_regressiva",
        "come_cotas", "dividendos_exterior", "tributado_anual",
    ] = "tributado_anual"
```

`api/routers/simulation.py` `_to_portfolio_params`: pass `tax_profile=a.tax_profile` into the `AssetClass(...)` construction.

- [ ] **Step 1.4: Run + commit**

`cd api && .venv/bin/python -m pytest -q` — 148 passed, 1 skipped.

```bash
git add api/core/config.py api/schemas/inputs.py api/routers/simulation.py api/tests/test_schemas_inputs.py
git commit -m "feat(api): TaxProfile enum + tax_profile on assets (fallback tributado_anual)"
```

---

### Task 2: Engine core — `_simulate_taxed_classes` + deterministic rewrite

**Files:**
- Modify: `api/core/models.py` (`SimulationResult` fields; new core; rewritten `simulate_portfolio`)
- Test: `api/tests/test_tax_engine.py` (new)

- [ ] **Step 2.1: Failing closed-form anchor tests**

Create `api/tests/test_tax_engine.py`:

```python
"""Closed-form anchors for the tax-aware engine."""
import numpy as np
import pytest

from core.config import AssetClass, PortfolioParams, regressive_rate
from core.models import simulate_portfolio


def _single(profile: str, *, y=0.0, g=0.0, tax_rate=0.0, monthly=0.0) -> PortfolioParams:
    return PortfolioParams(
        capital=100_000,
        monthly_contribution=monthly,
        contribution_inflation_indexed=False,
        assets=[AssetClass("A", 1.0, y, g, tax_rate, volatility=0.0, tax_profile=profile)],
    )


def test_isento_compounds_gross_with_zero_taxes():
    r = simulate_portfolio(_single("isento", y=0.10), 10)
    np.testing.assert_allclose(r.patrimony, 100_000 * 1.10 ** np.arange(11))
    np.testing.assert_allclose(r.gross_patrimony, r.patrimony)
    assert r.tax_paid_cumulative[-1] == 0
    assert r.exit_tax[-1] == 0


def test_invariant_net_equals_gross_minus_exit():
    r = simulate_portfolio(_single("rf_regressiva", g=0.12, monthly=1_000), 10)
    np.testing.assert_allclose(r.patrimony, r.gross_patrimony - r.exit_tax)


def test_tributado_anual_single_class_matches_old_engine():
    # old engine: rate = y(1-tax) + g compounded; gain never taxed.
    r = simulate_portfolio(_single("tributado_anual", y=0.10, g=0.02, tax_rate=0.30), 5)
    rate = 0.10 * 0.70 + 0.02
    np.testing.assert_allclose(r.patrimony, 100_000 * (1 + rate) ** np.arange(6), rtol=1e-9)
    assert r.exit_tax[-1] == 0


def test_rf_regressiva_lump_sum_exit_tax():
    h = 5
    r = simulate_portfolio(_single("rf_regressiva", g=0.12), h)
    gross = 100_000 * 1.12 ** h
    gain = gross - 100_000
    assert r.gross_patrimony[h] == pytest.approx(gross)
    assert r.exit_tax[h] == pytest.approx(0.15 * gain)        # 5y >= 2y bracket
    assert r.patrimony[h] == pytest.approx(gross - 0.15 * gain)


def test_rf_regressiva_tranche_brackets():
    # capital at t=0 plus aportes at t=0..h-1; horizon 2:
    # capital (2y) -> 15%; aporte t=0 (2y) -> 15%; aporte t=1 (1y) -> 17,5%.
    h = 2
    r = simulate_portfolio(_single("rf_regressiva", g=0.10, monthly=1_000), h)
    g = 0.10
    a = 12_000.0
    tr = [
        (100_000 + a, 2),   # capital + year-0 aporte enter together at t=0
        (a, 1),
    ]
    expected_exit = sum(
        regressive_rate(years) * (p * (1 + g) ** years - p) for p, years in tr
    )
    assert r.exit_tax[h] == pytest.approx(expected_exit)


def test_come_cotas_is_15pct_drag_on_positive_return():
    h = 10
    r = simulate_portfolio(_single("come_cotas", g=0.10), h)
    net_rate = 0.10 * (1 - 0.15)
    np.testing.assert_allclose(r.patrimony, 100_000 * (1 + net_rate) ** np.arange(h + 1), rtol=1e-9)
    assert r.exit_tax[-1] == 0
    assert r.tax_paid_cumulative[-1] > 0


def test_dividendos_exterior_wht_and_exit_on_gain():
    h = 3
    r = simulate_portfolio(_single("dividendos_exterior", y=0.04, g=0.06), h)
    # reinvested net yield raises basis; exit taxes only the accrued gain part
    assert r.tax_paid_cumulative[-1] > 0          # WHT charged annually
    assert r.exit_tax[-1] > 0                     # 15% on (value - basis)
    np.testing.assert_allclose(r.patrimony, r.gross_patrimony - r.exit_tax)


def test_fii_yield_exempt_gain_taxed_20_at_exit():
    h = 4
    r = simulate_portfolio(_single("fii", y=0.10, g=0.02), h)
    assert r.tax_paid_cumulative[-1] == 0
    # exit = 20% of (gross - basis); with all yield reinvested, basis grows too
    assert 0 < r.exit_tax[h] < 0.20 * (r.gross_patrimony[h] - 100_000)
```

Run — FAIL (`SimulationResult` lacks fields; engine not rewritten).

- [ ] **Step 2.2: `SimulationResult` fields**

In `api/core/models.py`, `SimulationResult` gains three required arrays (update the dataclass):

```python
    gross_patrimony: np.ndarray      # market value (latent exit tax inside)
    tax_paid_cumulative: np.ndarray  # path taxes paid (WHT + come-cotas + anual)
    exit_tax: np.ndarray             # tax due if fully redeemed at end of year y
```

(Constructors in `simulate_benchmark` get placeholder equal-shapes in this task — `gross_patrimony=patrimony.copy(), tax_paid_cumulative=np.zeros_like(patrimony), exit_tax=np.zeros_like(patrimony)` — Task 4 makes the benchmark real.)

- [ ] **Step 2.3: The core**

Add to `api/core/models.py` (imports: extend the `.config` import with `AssetClass, COME_COTAS_RATE, EXIT_GAIN_RATE, WHT_DIVIDENDOS_EXTERIOR, regressive_rate`):

```python
@dataclass(slots=True)
class TaxedSimOutput:
    """Arrays shaped (N, horizon+1); N=1 for the deterministic path."""
    net: np.ndarray
    gross: np.ndarray
    tax_paid_cumulative: np.ndarray
    exit_tax: np.ndarray
    income: np.ndarray                    # distributed yield (net of WHT/anual tax)
    per_class_final: list[dict]           # [{name, profile, tax_paid, exit_tax, net, gross}] — mean over N


def _simulate_taxed_classes(
    params: PortfolioParams,
    horizon_years: int,
    returns: np.ndarray,        # gross TOTAL return draws, shape (N, T, K)
    ipca: float,
    reinvest_income: bool,
) -> TaxedSimOutput:
    """Per-class, tax-aware accumulation (buy-and-hold; no rebalancing).

    Conventions: contributions enter begin-of-year split by weight (PMT-begin);
    each class's drawn return splits into a deterministic yield share
    (expected_yield) and the remainder as accrued gain; distributed yields are
    reinvested into the same class (raising its cost basis) when
    reinvest_income is True.
    """
    N, T, K = returns.shape
    assets = params.assets
    annual_base = 12.0 * params.monthly_contribution
    indexed = params.contribution_inflation_indexed

    value = np.zeros((K, N))
    basis = np.zeros((K, N))
    growth = np.ones((K, N, T + 1))            # cumulative gross factors (rf tranches)
    tranches: list[list[tuple[int, float]]] = [[] for _ in range(K)]
    tax_paid = np.zeros(N)

    for k, a in enumerate(assets):
        p0 = params.capital * a.weight
        value[k] += p0
        basis[k] += p0
        if a.tax_profile == "rf_regressiva":
            tranches[k].append((0, p0))

    gross_out = np.zeros((N, T + 1))
    net_out = np.zeros((N, T + 1))
    tax_paid_out = np.zeros((N, T + 1))
    exit_out = np.zeros((N, T + 1))
    income_out = np.zeros((N, T + 1))

    gross_out[:, 0] = value.sum(axis=0)
    net_out[:, 0] = gross_out[:, 0]            # year 0: nothing accrued yet
    income_out[:, 0] = sum(
        params.capital * a.weight * a.expected_yield *
        (1 - (WHT_DIVIDENDOS_EXTERIOR if a.tax_profile == "dividendos_exterior" else
              a.tax_rate if a.tax_profile == "tributado_anual" else 0.0))
        for a in assets
    )

    for t in range(T):
        aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0) if annual_base > 0 else 0.0
        for k, a in enumerate(assets):
            ap = aporte_t * a.weight
            if ap > 0:
                value[k] += ap
                basis[k] += ap
                if a.tax_profile == "rf_regressiva":
                    tranches[k].append((t, ap))

            r = returns[:, t, k]
            profile = a.tax_profile

            if profile == "rf_regressiva":
                value[k] *= (1 + r)
                growth[k, :, t + 1] = growth[k, :, t] * (1 + r)
                continue
            if profile == "come_cotas":
                ret = value[k] * r
                drag = COME_COTAS_RATE * np.maximum(ret, 0.0)
                value[k] = value[k] + ret - drag
                tax_paid += drag
                continue

            # distributed-yield profiles: yield share is deterministic, rest accrues
            y_rate = a.expected_yield
            g = r - y_rate
            dist_gross = value[k] * y_rate
            if profile == "dividendos_exterior":
                wht = WHT_DIVIDENDOS_EXTERIOR * dist_gross
                dist = dist_gross - wht
                tax_paid += wht
            elif profile == "tributado_anual":
                anual = a.tax_rate * dist_gross
                dist = dist_gross - anual
                tax_paid += anual
            else:                                   # isento, fii, acoes_br
                dist = dist_gross
            value[k] *= (1 + g)
            income_out[:, t + 1] += dist
            if reinvest_income:
                value[k] += dist
                basis[k] += dist

        # end-of-year snapshot
        gross_out[:, t + 1] = value.sum(axis=0)
        tax_paid_out[:, t + 1] = tax_paid
        exit_y = np.zeros(N)
        for k, a in enumerate(assets):
            profile = a.tax_profile
            if profile in EXIT_GAIN_RATE:
                exit_y += EXIT_GAIN_RATE[profile] * np.maximum(value[k] - basis[k], 0.0)
            elif profile == "rf_regressiva":
                for entry, p in tranches[k]:
                    v_tr = p * growth[k, :, t + 1] / growth[k, :, entry]
                    exit_y += regressive_rate(t + 1 - entry) * np.maximum(v_tr - p, 0.0)
        exit_out[:, t + 1] = exit_y
        net_out[:, t + 1] = gross_out[:, t + 1] - exit_y

    per_class_final = []
    for k, a in enumerate(assets):
        if a.tax_profile in EXIT_GAIN_RATE:
            cls_exit = float(np.mean(EXIT_GAIN_RATE[a.tax_profile] * np.maximum(value[k] - basis[k], 0.0)))
        elif a.tax_profile == "rf_regressiva":
            cls_exit = float(np.mean(sum(
                regressive_rate(T - entry) * np.maximum(p * growth[k, :, T] / growth[k, :, entry] - p, 0.0)
                for entry, p in tranches[k]
            )))
        else:
            cls_exit = 0.0
        cls_gross = float(np.mean(value[k]))
        per_class_final.append({
            "name": a.name,
            "profile": a.tax_profile,
            "exit_tax": cls_exit,
            "gross": cls_gross,
            "net": cls_gross - cls_exit,
        })

    return TaxedSimOutput(
        net=net_out, gross=gross_out, tax_paid_cumulative=tax_paid_out,
        exit_tax=exit_out, income=income_out, per_class_final=per_class_final,
    )
```

NOTE for the implementer: per-class `tax_paid` is aggregated globally (the `tax_paid` array); if splitting per class for `per_class_final` is cheap (a (K,N) accumulator instead of (N,)), do it and include `"tax_paid"` per class — the Fase B table wants it. Prefer the (K,N) accumulator; sum over K for the global outputs.

- [ ] **Step 2.4: Rewrite `simulate_portfolio`**

Replace its body (signature unchanged):

```python
def simulate_portfolio(
    params: PortfolioParams,
    horizon_years: int,
    reinvest_income: bool = True,
    ipca: float = 0.0,
) -> SimulationResult:
    """Tax-aware portfolio simulation (deterministic = the σ=0, N=1 MC path)."""
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    K = len(params.assets)
    gross_means = np.array([a.gross_return for a in params.assets])
    returns = np.tile(gross_means, (1, horizon_years, 1))   # (1, T, K)

    out = _simulate_taxed_classes(params, horizon_years, returns, ipca, reinvest_income)

    years = np.arange(0, horizon_years + 1)
    annual_income = out.income[0]
    return SimulationResult(
        years=years,
        patrimony=out.net[0],
        annual_income=annual_income,
        cumulative_income=np.cumsum(annual_income),
        label="Carteira Diversificada",
        color="#27AE60",
        gross_patrimony=out.gross[0],
        tax_paid_cumulative=out.tax_paid_cumulative[0],
        exit_tax=out.exit_tax[0],
    )
```

(`np.tile(gross_means, (1, T, 1))` produces (1, T, K) — verify shape with a quick assert while developing.)

- [ ] **Step 2.5: Run anchors + fix existing test fallout**

`cd api && .venv/bin/python -m pytest tests/test_tax_engine.py -v` — all PASS.

Then full suite: tests that asserted old multi-class blended outputs will fail (behavior change #2) — update them: prefer converting fixtures to single-class (pin survives) or recomputing expected values per-class buy-and-hold (show the math in a comment). `test_sensitivity_portfolio.py` and `test_goal_solve.py` use multi-class fixtures but assert PROPERTIES (monotonicity, reproducibility) — they keep passing; spot-check. The integration test "simulate median falls inside MC band" stays valid (both paths net). Report any test whose intent can't be preserved.

- [ ] **Step 2.6: Commit**

```bash
git add api/core/models.py api/tests/
git commit -m "feat(api): tax-aware per-class engine — net-of-redemption patrimony"
```

---

### Task 3: Monte Carlo over the same core

**Files:**
- Modify: `api/core/models.py` (`simulate_portfolio_mc`)
- Test: extend `api/tests/test_tax_engine.py`

- [ ] **Step 3.1: Failing tests**

```python
from core.config import MonteCarloParams
from core.models import simulate_portfolio_mc


def test_mc_sigma_zero_matches_deterministic():
    pf = _single("rf_regressiva", g=0.12, monthly=1_000)
    det = simulate_portfolio(pf, 5)
    mc = simulate_portfolio_mc(pf, 5, MonteCarloParams(n_trajectories=100, seed=1))
    np.testing.assert_allclose(mc.trajectories[0], det.patrimony, rtol=1e-9)


def test_mc_is_seed_stable():
    pf = _single("come_cotas", g=0.10)
    pf.assets[0].volatility = 0.2
    a = simulate_portfolio_mc(pf, 5, MonteCarloParams(n_trajectories=200, seed=42))
    b = simulate_portfolio_mc(pf, 5, MonteCarloParams(n_trajectories=200, seed=42))
    np.testing.assert_array_equal(a.final_distribution, b.final_distribution)


def test_mc_trajectories_are_net_of_redemption():
    pf = _single("rf_regressiva", g=0.12)
    pf.assets[0].volatility = 0.1
    mc = simulate_portfolio_mc(pf, 5, MonteCarloParams(n_trajectories=500, seed=7))
    det = simulate_portfolio(pf, 5)
    # net < gross would-be: median must sit near the deterministic NET path
    assert mc.percentiles["p50"][-1] == pytest.approx(det.patrimony[-1], rel=0.05)
```

- [ ] **Step 3.2: Rewrite `simulate_portfolio_mc`**

Replace the means/loop body — draws become GROSS and the core does the rest:

```python
    rng = np.random.default_rng(mc_params.seed)
    N, T = mc_params.n_trajectories, horizon_years
    K = len(params.assets)

    means = np.array([a.gross_return for a in params.assets])
    sigmas = np.array([a.volatility for a in params.assets])
    draws = _draw_normal_returns(rng, mean=means, sigma=sigmas, shape=(N, T, K))

    out = _simulate_taxed_classes(params, T, draws, ipca, reinvest_income=True)
    trajectories = out.net

    return MonteCarloResult(
        trajectories=trajectories,
        percentiles=_compute_percentiles(trajectories),
        final_distribution=trajectories[:, -1].copy(),
        max_drawdowns=_compute_max_drawdowns(trajectories),
        label="Carteira (MC)",
        color="#27AE60",
    )
```

(Old weighted-sum/blended code dies. `_draw_normal_returns` unchanged.)

- [ ] **Step 3.3: Run + commit**

Full suite green (update MC fixtures per the Task 2.5 policy if any assert exact multi-class values).

```bash
git add api/core/models.py api/tests/
git commit -m "feat(api): Monte Carlo rides the tax-aware core (net trajectories)"
```

---

### Task 4: Benchmark = `rf_regressiva` via the core

**Files:**
- Modify: `api/core/models.py` (`simulate_benchmark`), `api/core/config.py` (`BenchmarkParams` docstring/net_yield), `api/schemas/inputs.py` (BenchmarkInput.tax_rate note)
- Test: `api/tests/test_benchmark.py` (rewrite affected tests)

- [ ] **Step 4.1: Failing tests**

Replace the affected `test_benchmark.py` cases (keep label/horizon-guard tests):

```python
def test_benchmark_defers_tax_lump_sum():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10)
    r = simulate_benchmark(params, horizon_years=5)
    gross = 100_000 * 1.10 ** 5
    expected_net = gross - 0.15 * (gross - 100_000)
    assert r.patrimony[5] == pytest.approx(expected_net)
    assert r.gross_patrimony[5] == pytest.approx(gross)


def test_benchmark_deferral_beats_flat_annual_tax():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10)
    r = simulate_benchmark(params, horizon_years=10)
    flat = 100_000 * (1 + 0.10 * (1 - 0.15)) ** 10
    assert r.patrimony[10] > flat


def test_benchmark_aporte_tranches_use_regressive_brackets():
    params = BenchmarkParams(capital=0.0001, annual_rate=0.10, monthly_contribution=1_000,
                             contribution_inflation_indexed=False)
    r = simulate_benchmark(params, horizon_years=2)
    a, g = 12_000.0, 0.10
    expected_exit = (
        regressive_rate(2) * (a * 1.1**2 - a) + regressive_rate(1) * (a * 1.1 - a)
    )
    assert r.exit_tax[2] == pytest.approx(expected_exit, rel=1e-3)
```

- [ ] **Step 4.2: Implement**

`simulate_benchmark` delegates to the core with a synthetic single class:

```python
def simulate_benchmark(
    params: BenchmarkParams,
    horizon_years: int,
    ipca: float = 0.0,
) -> SimulationResult:
    """Passive benchmark as a deferred-RF position (regressiva per tranche)."""
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    synthetic = PortfolioParams(
        capital=params.capital,
        monthly_contribution=params.monthly_contribution,
        contribution_inflation_indexed=params.contribution_inflation_indexed,
        assets=[AssetClass("benchmark", 1.0, 0.0, params.annual_rate,
                           volatility=0.0, tax_profile="rf_regressiva")],
    )
    returns = np.tile(np.array([params.annual_rate]), (1, horizon_years, 1))
    out = _simulate_taxed_classes(synthetic, horizon_years, returns, ipca, reinvest_income=True)

    years = np.arange(0, horizon_years + 1)
    rate = out.net[0]
    annual_income = np.array([0.0] + [out.net[0][y] - out.net[0][y - 1] for y in range(1, horizon_years + 1)])
```

WAIT — keep `annual_income` semantics: the benchmark previously reported yield-style income. With accrual there is no distribution; report the year-over-year NET growth as income (it's what the MonthlyIncomeCard plots):

```python
    annual_income = np.diff(out.net[0], prepend=out.net[0][0])
    annual_income[0] = out.net[0][0] * params.annual_rate * (1 - 0.15)  # display-only year-0 anchor
    return SimulationResult(
        years=years,
        patrimony=out.net[0],
        annual_income=annual_income,
        cumulative_income=np.cumsum(annual_income),
        label=params.label,
        color="#F39C12",
        gross_patrimony=out.gross[0],
        tax_paid_cumulative=out.tax_paid_cumulative[0],
        exit_tax=out.exit_tax[0],
    )
```

`BenchmarkParams.net_yield()` and `tax_rate` become legacy: keep the field (ignored) with a comment; remove `net_yield()` if `grep -rn "net_yield" api/` shows no remaining callers (the old simulate_benchmark was the only one — annual_tax_comparison dies in Task 5; verify). `BenchmarkInput.tax_rate` stays accepted-and-ignored (comment: compat).

- [ ] **Step 4.3: Run + fix fallout + commit**

Benchmark-dependent tests recalibrate (values rise). The e2e/web fixtures are Fase B's problem (web suite isn't run by api commits).

```bash
git add api/core/ api/schemas/inputs.py api/tests/
git commit -m "feat(api): benchmark is deferred RF (regressiva per tranche)"
```

---

### Task 5: API payload — `tax_projection`, new result fields, sensitivity horizonte

**Files:**
- Modify: `api/schemas/outputs.py`, `api/converters.py`, `api/routers/simulation.py`, `api/core/models.py` (sensitivity row swap; DELETE `annual_tax_comparison`)
- Test: `api/tests/test_endpoint_simulate.py` (extend), `api/tests/test_benchmark.py` (remove tax_comparison test), `api/tests/test_sensitivity_portfolio.py` (row swap)

- [ ] **Step 5.1: Failing endpoint tests**

```python
def test_simulate_returns_tax_projection_and_result_tax_fields():
    resp = client.post("/api/simulate", json=_default_payload())
    body = resp.json()
    assert "taxProjection" in body and "taxComparison" not in body
    tp = body["taxProjection"]
    assert {"rows", "taxPaidByYear", "exitTaxByYear", "allTaxedFinal"} <= set(tp)
    assert {"name", "taxProfile", "taxPaidPath", "exitTax", "netFinal", "grossFinal"} <= set(tp["rows"][0])
    for key in ("grossPatrimony", "taxPaidCumulative", "exitTax"):
        assert key in body["portfolio"] and key in body["benchmark"]


def test_sensitivity_has_horizonte_row_not_ir():
    rows = client.post("/api/simulate", json=_default_payload()).json()["sensitivity"]
    labels = {r["parameter"] for r in rows}
    assert "Horizonte (−2a / +2a)" in labels
    assert not any("IR efetivo" in l for l in labels)
```

- [ ] **Step 5.2: Schemas + converters**

`api/schemas/outputs.py`: `SimulationResultOut` gains `gross_patrimony: list[float]`, `tax_paid_cumulative: list[float]`, `exit_tax: list[float]`. Delete `TaxComparisonRowOut`; add:

```python
class TaxProjectionRowOut(_CamelModel):
    name: str
    tax_profile: str
    tax_paid_path: float
    exit_tax: float
    net_final: float
    gross_final: float


class TaxProjectionOut(_CamelModel):
    rows: list[TaxProjectionRowOut]
    tax_paid_by_year: list[float]
    exit_tax_by_year: list[float]
    all_taxed_final: float       # net final if EVERY class were rf_regressiva ("o que suas isenções valem")
```

`SimulateOut`: `tax_comparison: list[TaxComparisonRowOut]` → `tax_projection: TaxProjectionOut`.

`api/converters.py` `simulation_result_to_dto` passes the three new arrays through `_to_list`.

- [ ] **Step 5.3: Router + models**

- `api/core/models.py`: DELETE `annual_tax_comparison`. In `sensitivity_portfolio`, replace the IR variation with:

```python
        ("Horizonte (−2a / +2a)",
         None, None),   # handled specially below
```

Concretely: restructure so the horizonte row computes `final_patrimony_at(max(horizon_years - 2, 1))` (pessimistic) and `final_patrimony_at(min(horizon_years + 2, 30))` (optimistic) with base params — add a small inner `def final_at(h): return float(simulate_portfolio(base_params, h, reinvest_income=True, ipca=ipca).patrimony[-1])` and build that row from it; the other three rows keep the `variant()` mechanism. Update `api/tests/test_sensitivity_portfolio.py` labels accordingly (the optimistic≥pessimistic invariant holds: longer horizon ⇒ ≥ patrimony for non-negative rates — keep fixtures non-negative).

- `api/routers/simulation.py` `simulate()`: drop the tax_comparison block; build the projection — the det portfolio run must expose per-class data: change the router to call `_simulate_taxed_classes` directly? NO — keep the boundary: add to `models.py`:

```python
def tax_projection(
    pf_params: PortfolioParams,
    bench_params: BenchmarkParams,
    horizon_years: int,
    ipca: float,
) -> dict:
    """Forward tax breakdown: per-class rows + portfolio-level series + the
    all-taxed counterfactual (every class forced to rf_regressiva)."""
    gross_means = np.array([a.gross_return for a in pf_params.assets])
    returns = np.tile(gross_means, (1, horizon_years, 1))
    out = _simulate_taxed_classes(pf_params, horizon_years, returns, ipca, True)

    bench = simulate_benchmark(bench_params, horizon_years, ipca=ipca)
    rows = [
        {
            "name": c["name"], "tax_profile": c["profile"],
            "tax_paid_path": c.get("tax_paid", 0.0), "exit_tax": c["exit_tax"],
            "net_final": c["net"], "gross_final": c["gross"],
        }
        for c in out.per_class_final
    ]
    rows.append({
        "name": bench.label, "tax_profile": "rf_regressiva",
        "tax_paid_path": float(bench.tax_paid_cumulative[-1]),
        "exit_tax": float(bench.exit_tax[-1]),
        "net_final": float(bench.patrimony[-1]),
        "gross_final": float(bench.gross_patrimony[-1]),
    })

    all_taxed = replace(pf_params, assets=[
        replace(a, tax_profile="rf_regressiva") for a in pf_params.assets
    ])
    all_taxed_final = float(
        simulate_portfolio(all_taxed, horizon_years, ipca=ipca).patrimony[-1]
    )

    return {
        "rows": rows,
        "tax_paid_by_year": out.tax_paid_cumulative[0].tolist(),
        "exit_tax_by_year": out.exit_tax[0].tolist(),
        "all_taxed_final": all_taxed_final,
    }
```

Router: `tax_projection_payload = tax_projection(pf_params, bench_params, payload.horizon, ipca)` → `SimulateOut(..., tax_projection=TaxProjectionOut(**tax_projection_payload))`. Remove now-unused `TaxComparisonRowOut` imports.

- [ ] **Step 5.4: Run + commit**

Full API suite green (153-ish; report exact).

```bash
git add api/
git commit -m "feat(api): tax_projection payload + horizonte sensitivity; tax_comparison dies"
```

---

### Task 6: Fase A gate — goal solver sanity + full API verification

**Files:** test-only.

- [ ] **Step 6.1:** Add to `api/tests/test_goal_solve.py`: with a `rf_regressiva` single-class portfolio (vol 0), the solved contribution achieves `P(net ≥ goal)` — i.e. re-simulate at the returned contribution and assert `simulate_portfolio(...).patrimony[-1] >= goal` (net semantics inherited).
- [ ] **Step 6.2:** `cd api && .venv/bin/python -m pytest -q` — all green (report exact count). Commit:

```bash
git add api/tests/test_goal_solve.py
git commit -m "test(api): solver targets net-of-redemption patrimony — fase A gate"
```

---

# FASE B — Web

### Task 7: Web types, catalog, dialog, store v7, bridge

**Files:**
- Modify: `web/lib/api-types.ts`, `web/lib/portfolio-asset-types.ts`, `web/lib/defaults.ts`, `web/lib/store.ts`, `web/lib/portfolio-bridge.ts`, `web/components/scenario-drawer/PortfolioAssetDialog.tsx`, `web/components/scenario-drawer/schema.ts`
- Test: `web/tests/store-migration.test.ts`, `web/tests/portfolio-bridge.test.ts`, `web/tests/portfolio-asset-dialog.test.tsx` (or wherever the dialog is covered — grep)

- [ ] **Step 7.1: Types + catalog (failing tests first where pinned)**

`web/lib/api-types.ts`:

```ts
export type TaxProfile =
  | "isento" | "fii" | "acoes_br" | "rf_regressiva"
  | "come_cotas" | "dividendos_exterior" | "tributado_anual";
```

`PortfolioAssetInput` gains `taxProfile: TaxProfile;`. `SimulationResultOut` gains `grossPatrimony: number[]; taxPaidCumulative: number[]; exitTax: number[];`. `SimulateOut.taxComparison` → `taxProjection: TaxProjectionOut` with:

```ts
export type TaxProjectionRowOut = {
  name: string; taxProfile: string; taxPaidPath: number;
  exitTax: number; netFinal: number; grossFinal: number;
};
export type TaxProjectionOut = {
  rows: TaxProjectionRowOut[]; taxPaidByYear: number[];
  exitTaxByYear: number[]; allTaxedFinal: number;
};
```

Delete `TaxComparisonRowOut`. `BenchmarkInput.taxRate` removed from the TS type (compat lives server-side).

`web/lib/portfolio-asset-types.ts`: each catalog entry's `defaults` gains `taxProfile` (FII→"fii", ACAO_BR_DIV/CRESC→"acoes_br", ETF_BR→"acoes_br", STOCK_US/REIT_US/ETF_US→"dividendos_exterior", RF_PUBLICO/RF_PRIVADO→"rf_regressiva", CUSTOM→"tributado_anual"). `web/lib/defaults.ts` DEFAULT_SCENARIO assets gain matching `taxProfile` (FIIs→"fii", Ações BR→"acoes_br", Aristocrats→"dividendos_exterior", Tesouro/LCI→"rf_regressiva"); benchmark loses `taxRate`.

- [ ] **Step 7.2: Store v7 (failing test first)**

Migration: pre-v7 persisted asset rows lack `taxProfile` and the benchmark may carry `taxRate`. v7: stamp `taxProfile` per row by matching the row `name` against catalog labels (exact match → that type's profile; else `"tributado_anual"`); delete `scenario.benchmark.taxRate`. Tests mirror the v6 pattern (inject by known name; unknown name → tributado_anual; passthrough at v7; benchmark.taxRate dropped).

- [ ] **Step 7.3: Dialog + zod**

`web/components/scenario-drawer/schema.ts` `portfolioAssetSchema` gains `taxProfile: z.enum([...7 values])`; `benchmarkSchema` loses `taxRate`. `PortfolioAssetDialog.tsx`: add a "Perfil tributário" `<select>` (same idiom as its existing type select, labels: Isento (LCI/LCA), FII, Ações BR, RF regressiva (CDB/Tesouro), Fundo (come-cotas), Dividendos exterior, Tributado anual); `handleTypeChange` also sets the profile from the catalog default; submit passes it through. Its zod percent-conversion handling does NOT apply (profile is not a percent). Tests: select renders, type change updates profile, submit includes it.

- [ ] **Step 7.4: Bridge**

`web/lib/portfolio-bridge.ts`: RV rows get `taxProfile` from a class→profile map (FII→"fii", ACAO_BR_*→"acoes_br", ETF_BR→"acoes_br", STOCK_US/REIT_US/ETF_US→"dividendos_exterior", BDR→"dividendos_exterior"); RF rows: bucket RF_PUBLICO with `isTaxExempt` positions… the bucket mixes exempt and Tesouro — split rule: position-level `isTaxExempt → "isento"`, else `"rf_regressiva"`; since rows are buckets, make the ISENTO positions their own row when present: RF_PUBLICO splits into "Renda Fixa Isenta (LCI/LCA)" (profile isento) and "Renda Fixa Tesouro" (rf_regressiva) — adjust the existing bucket rule: `isTaxExempt → ISENTO bucket`, `TESOURO_REGEX → RF_PUBLICO`, else `RF_PRIVADO`; max rows becomes 8+3=11 ≤ 12 ✓. Update bridge tests (bucket split, profiles on rows).

- [ ] **Step 7.5: Run + commit**

`cd web && npx vitest run && npx tsc --noEmit` — tsc will drag remaining `taxComparison`/`taxRate` consumers (tributação page, carteira-derive, fixtures): the tributação page is REWRITTEN in Task 9 — to keep this commit green, update fixtures and replace `benchmarkNetYield(b)`'s `taxRate` use NOW with the horizon-aware form (move Task 8's lib change here if tsc demands it; report what you pulled forward). Commit:

```bash
git add web/
git commit -m "feat(web): taxProfile types/catalog/dialog/bridge + store v7"
```

---

### Task 8: Benchmark UX — drawer field removal + horizon-aware net rate

**Files:**
- Modify: `web/components/scenario-drawer/sections/BenchmarkSection.tsx`, `web/lib/carteira-derive.ts`
- Test: `web/tests/benchmark-section.test.tsx`, `web/tests/carteira-derive.test.ts`

- [ ] **Step 8.1:** Remove the "IR sobre rendimentos" input from BenchmarkSection (tests updated). `web/lib/carteira-derive.ts`:

```ts
/** Effective NET annual rate of a deferred-RF lump sum held for `horizon` years. */
export function benchmarkNetYield(b: BenchmarkInput, horizonYears: number): number {
  const rate = horizonYears >= 2 ? 0.15 : 0.175;
  const gross = Math.pow(1 + b.annualRate, horizonYears);
  const net = 1 + (gross - 1) * (1 - rate);
  return Math.pow(net, 1 / horizonYears) - 1;
}
```

`yieldComparison` gains `horizonYears` arg; `YieldComparisonCard`/`CarteiraPageContent` pass `scenario.horizon`. Tests: lump-sum h=10 vs h=1 rates; label unchanged.

- [ ] **Step 8.2:** Run + commit (`feat(web): benchmark IR automático (regressiva) — campo sai do drawer`).

---

### Task 9: Página Tributação forward

**Files:**
- Rewrite: `web/components/tributacao/TributacaoPageContent.tsx`, `KpiRowTributacao.tsx`, `TributacaoTable.tsx`; REPLACE `TaxComparisonChart.tsx` with `TaxTimelineChart.tsx`; `web/lib/tributacao-derive.ts`
- Test: `web/tests/tributacao-page.test.tsx`, `web/tests/tributacao-derive.test.ts`

- [ ] **Step 9.1: Derive lib (failing tests first)**

`web/lib/tributacao-derive.ts` exports become:

```ts
export type TaxKpis = {
  totalTax: number;          // path + exit at horizon
  effectiveRate: number;     // totalTax / gross gain
  latentExitTax: number;     // exitTax at horizon
  exemptionValue: number;    // portfolio net final − allTaxedFinal
};

export function taxKpis(sim: SimulateOut): TaxKpis;
```

(`totalTax = taxPaidByYear[last] + exitTaxByYear[last]`; `effectiveRate = totalTax / (grossFinal − contributed)` — contributed = portfolio.grossPatrimony[0] + Σaportes… aportes aren't in the payload; use `grossGain = portfolio.grossPatrimony[last] − portfolio.grossPatrimony[0]` as the denominator and document the approximation when aportes > 0 — OR compute contributed from the scenario store in the component and pass it in: `taxKpis(sim, contributedTotal)`. Take the second: precise. `contributedTotal = capital + 12×monthly×Σ(1+ipca)^t` — helper `totalContributed(scenario)` exported here too.) Keep `SCENARIO_COLORS` (benchmark/portfolio/tax) and `TAX_NOTES` (review copy: add come-cotas note, drop stale ones).

- [ ] **Step 9.2: Components**

- `KpiRowTributacao`: 4 KpiCards — "IR total no horizonte" (totalTax, sub "caminho R$X · saída R$Y"), "Alíquota efetiva" (formatPercent), "IR latente na saída" (latentExitTax), "Suas isenções valem" (exemptionValue, green, feature). All deflated via `useDeflation().at(value, horizon)` in real mode + the established badge/suffix pattern.
- `TaxTimelineChart`: LineChart with two series — `taxPaidByYear` (cumulative path) and `taxPaidByYear + exitTaxByYear` (total if redeemed) — band between them labeled "IR de saída (latente)". Deflate series in real mode.
- `TributacaoTable`: rows from `taxProjection.rows` — colunas Classe (+ perfil chip), IR no caminho, IR na saída, Líquido final, Alíquota efetiva da classe (`(taxPaidPath+exitTax)/(grossFinal − netFinal + taxPaidPath + ... )` — simplest honest: `(taxPaidPath + exitTax) / grossFinal` labeled "% do bruto"). Profile chip labels from a `TAX_PROFILE_LABEL` record in tributacao-derive.
- `TributacaoPageContent`: composes KPIs + chart + table + TaxNotesCard + (Task 10/11 cards).

Tests: fixture `taxProjection` + both display modes + table rows + chart presence.

- [ ] **Step 9.3:** Run + commit (`feat(web): página tributação forward (KPIs, timeline de IR, tabela por classe)`).

---

### Task 10: Comparador LCI vs CDB

**Files:**
- Create: `web/lib/tax-compare.ts`, `web/components/tributacao/LciCdbCard.tsx`
- Test: `web/tests/tax-compare.test.ts`

- [ ] **Step 10.1:** TDD the lib:

```ts
import { equivalentCdbRate } from "@/lib/tax-compare";

it("h>=2 uses the 15% bracket", () => {
  // lci 10% a.a., h=10: r = (1 + ((1.1^10 −1)/0.85))^(1/10) − 1
  const r = equivalentCdbRate(0.10, 10);
  expect(r).toBeCloseTo(Math.pow(1 + (Math.pow(1.1, 10) - 1) / 0.85, 1 / 10) - 1, 10);
  expect(r).toBeGreaterThan(0.10);
});
it("h=1 uses 17,5%", () => {
  const r = equivalentCdbRate(0.10, 1);
  expect(r).toBeCloseTo(0.10 / 0.825, 6);
});
```

Implementation:

```ts
const rate = (h: number) => (h >= 2 ? 0.15 : 0.175);

/** CDB gross rate that nets the same as an LCI at `lciRate` over `horizonYears`. */
export function equivalentCdbRate(lciRate: number, horizonYears: number): number {
  const target = Math.pow(1 + lciRate, horizonYears);
  const gross = 1 + (target - 1) / (1 - rate(horizonYears));
  return Math.pow(gross, 1 / horizonYears) - 1;
}
```

- [ ] **Step 10.2:** Card: input "Taxa da LCI (a.a.)" (default: the scenario's first `isento` RF row expectedYield, else 0.09), reads horizon from the store, shows equivalent CDB a.a. and as % do CDI (`equivalent / macro.cdi`, useMacro; omit when macro absent). Component test with mocked macro. Wire into TributacaoPageContent.
- [ ] **Step 10.3:** Run + commit (`feat(web): comparador LCI vs CDB equivalente`).

---

### Task 11: Comparador PGBL vs VGBL

**Files:**
- Create: `web/lib/previdencia.ts`, `web/components/tributacao/PrevidenciaCard.tsx`
- Test: `web/tests/previdencia.test.ts`

- [ ] **Step 11.1:** TDD the lib:

```ts
export type PrevidenciaInputs = {
  rendaTributavelAnual: number;
  aporteAnual: number;           // capped at 12% da renda for the deduction
  aliquotaMarginal: number;      // 0.075 | 0.15 | 0.225 | 0.275
  taxaRetorno: number;           // a.a.
  horizonYears: number;
};
export type PrevidenciaResult = {
  netPgbl: number; netVgbl: number; diff: number;
  deductionUsedAnnual: number;   // min(aporte, 12% renda)
};
export function comparePrevidencia(i: PrevidenciaInputs): PrevidenciaResult;

/** Regressiva de previdência por tranche: 35% − 5%×⌊anos/2⌋, piso 10%. */
export function previdenciaRate(holdingYears: number): number;
```

Model (annual steps, begin-of-year aportes, tranche-correct exit):
- `previdenciaRate(y) = Math.max(0.35 - 0.05 * Math.floor(y / 2), 0.10)`.
- PGBL: each year invest `A + deduction` where `deduction = min(A, 0.12×renda) × aliquotaMarginal` (restituição reinvestida no plano); exit tax per tranche = `previdenciaRate(h−t) × trancheVALUE` (PGBL taxes the TOTAL, not the gain).
- VGBL: invest `A` per year; exit per tranche = `previdenciaRate(h−t) × trancheGAIN`.
Tests: marginal 27,5%, h=12, retorno 8% → PGBL > VGBL; marginal 7,5%, h=4 → VGBL ≥ PGBL; previdenciaRate table (1→35? `floor(1/2)=0` →35%... wait year-1 tranche: 35%? Brazilian table: ≤2a 35%, 2-4 30%, 4-6 25%, 6-8 20%, 8-10 15%, >10 10% — so rate(y) = y > 10 ? 0.10 : 0.35 − 0.05×⌊y/2⌋ with ⌊⌋ capping: rate(1)=0.35, rate(3)=0.30, rate(11)=0.10. Pin exactly these in tests.)

- [ ] **Step 11.2:** Card: 4 inputs (renda, aporte anual, select alíquota, taxa retorno — default `benchmarkNetYield(scenario.benchmark, horizon)`+gross? use scenario benchmark `annualRate` as default), horizon from store; renders líquido PGBL/VGBL/diferença + verdict copy ("PGBL compensa com declaração completa e prazo ≥ Xa" when diff > 0). Component test. Wire into the page.
- [ ] **Step 11.3:** Run + commit (`feat(web): comparador PGBL vs VGBL (regressiva por tranche)`).

---

### Task 12: Sweep, e2e, full verification, docs

- [ ] **Step 12.1:** Sensibilidade fixtures: tornado row label "IR efetivo (±5pp)" → "Horizonte (−2a / +2a)" in `web/tests/sensibilidade-page.test.tsx` (+ any other fixture greps: `grep -rn "IR efetivo" web/`). e2e `web/e2e/` fixtures: api-mocks gain `taxProjection` + the three new SimulationResultOut arrays; any spec asserting tributação content updates to the forward page; add one e2e: Tributação renders KPIs + comparators interact (fill LCI rate, see equivalent).
- [ ] **Step 12.2:** Full gate:

```bash
cd api && .venv/bin/python -m pytest -q
cd ../web && npx vitest run && npx tsc --noEmit && npm run lint
npx playwright test && npm run build
```

- [ ] **Step 12.3:** Docs: FUTURE_IMPROVEMENTS shipped section ("Tributação forward — ✅ shipped" + the 5 behavior changes listed in the header as release notes + deferred: rebalanceamento tributado, JCP, previdência como classe). Spec: `Status: In review`→`Implemented` AND amend §2's regression-pin sentence to the single-class form (per the plan header). Commit `feat: tributação forward completa — fase B + docs`.

---

## Self-review notes (already applied)

- Spec §1 profiles table → Task 1 (enum/constants) + Task 2 core (exact event semantics per profile). §2 engine → Tasks 2-4 (det/MC/benchmark on ONE core; goal solver inherited, gated in Task 6). §3 contract → Task 5 (tax_projection incl. all_taxed_final for the §4 KPI). §4 page → Task 9. §5 comparators → Tasks 10-11 (formulas spelled; previdência table pinned). §6 edges → store v7 (Task 7), benchmark tax_rate compat (Task 4), no-drag-on-losses (core code `np.maximum(ret, 0)`). §7 testing list mapped.
- Spec amendment (single-class pin) encoded in header + Task 12.3.
- Type consistency: `TaxedSimOutput.per_class_final` dicts consumed by `tax_projection()` (Task 5) with the `tax_paid` key noted as the (K,N) accumulator option in Task 2.3's NOTE — implementer must include it (Task 5 reads `c.get("tax_paid", 0.0)` so a missing key degrades gracefully, but DO implement the per-class accumulator).
- `reinvest_income=False` semantics change documented (header change #3); no current UI sets it to False (drawer always sends `reinvest` — actually SimulateInput.reinvest defaults True and the drawer has a switch: behavior change is user-visible if the switch is off — Task 2.5 must verify the reinvest=False path doesn't crash and produces sane output; one test: isento with reinvest=False → patrimony grows only by gain, income not reinvested).
