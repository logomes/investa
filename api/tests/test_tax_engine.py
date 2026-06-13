"""Closed-form anchors for the tax-aware engine."""
import numpy as np
import pytest

from core.config import AssetClass, MonteCarloParams, PortfolioParams, regressive_rate
from core.models import simulate_portfolio, simulate_portfolio_mc, _simulate_taxed_classes


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
    assert r.exit_tax[h] == pytest.approx(0.15 * gain)
    assert r.patrimony[h] == pytest.approx(gross - 0.15 * gain)


def test_rf_regressiva_tranche_brackets():
    # horizon 2: capital + year-0 aporte (held 2y -> 15%); year-1 aporte (1y -> 17,5%).
    h = 2
    r = simulate_portfolio(_single("rf_regressiva", g=0.10, monthly=1_000), h)
    g = 0.10
    a = 12_000.0
    tr = [
        (100_000 + a, 2),
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
    assert r.tax_paid_cumulative[-1] > 0
    assert r.exit_tax[-1] > 0
    np.testing.assert_allclose(r.patrimony, r.gross_patrimony - r.exit_tax)


def test_fii_yield_exempt_gain_taxed_20_at_exit():
    h = 4
    r = simulate_portfolio(_single("fii", y=0.10, g=0.02), h)
    assert r.tax_paid_cumulative[-1] == 0
    assert 0 < r.exit_tax[h] < 0.20 * (r.gross_patrimony[h] - 100_000)


def test_reinvest_false_keeps_accrual_but_not_distributions():
    r = simulate_portfolio(_single("isento", y=0.08, g=0.02), 5, reinvest_income=False)
    # value grows only by the gain component; income flows out
    np.testing.assert_allclose(r.patrimony, 100_000 * 1.02 ** np.arange(6), rtol=1e-9)
    assert r.annual_income[1] == pytest.approx(100_000 * 0.08)


def test_multi_class_buy_and_hold_drifts_weights():
    pf = PortfolioParams(
        capital=100_000, monthly_contribution=0.0,
        contribution_inflation_indexed=False,
        assets=[
            AssetClass("HI", 0.5, 0.0, 0.15, volatility=0.0, tax_profile="isento"),
            AssetClass("LO", 0.5, 0.0, 0.03, volatility=0.0, tax_profile="isento"),
        ],
    )
    r = simulate_portfolio(pf, 10)
    hi = 50_000 * 1.15 ** 10
    lo = 50_000 * 1.03 ** 10
    assert r.patrimony[10] == pytest.approx(hi + lo)   # per-class, no rebalance
    assert hi / (hi + lo) > 0.7                        # weights drifted


def test_come_cotas_no_drag_on_negative_year():
    pf = _single("come_cotas")
    returns = np.array([[[0.10], [-0.20], [0.10]]])    # (1, 3, 1)
    out = _simulate_taxed_classes(pf, 3, returns, ipca=0.0, reinvest_income=True)
    paid = out.tax_paid_cumulative[0]
    assert paid[2] == paid[1]                          # flat across the loss year
    assert paid[3] > paid[2]


# ---------- MC tests that exercise the tax-aware core ----------

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
    assert mc.percentiles["p50"][-1] == pytest.approx(det.patrimony[-1], rel=0.05)


def test_tax_projection_rows_sum_to_portfolio_and_include_benchmark():
    from core.config import BenchmarkParams
    from core.models import tax_projection

    pf = PortfolioParams(
        capital=100_000, monthly_contribution=500.0,
        contribution_inflation_indexed=False,
        assets=[
            AssetClass("FII", 0.5, expected_yield=0.10, capital_gain=0.01, volatility=0.0, tax_profile="fii"),
            AssetClass("CDB", 0.5, expected_yield=0.0, capital_gain=0.12, volatility=0.0, tax_profile="rf_regressiva"),
        ],
    )
    bench = BenchmarkParams(capital=100_000, annual_rate=0.10)
    proj = tax_projection(pf, bench, horizon_years=6, ipca=0.0)

    assert len(proj["rows"]) == 3                      # 2 classes + benchmark
    pf_rows = proj["rows"][:2]
    assert sum(r["net_final"] for r in pf_rows) == pytest.approx(
        float(simulate_portfolio(pf, 6).patrimony[-1])
    )
    for r in proj["rows"]:
        assert r["net_final"] == pytest.approx(r["gross_final"] - r["exit_tax"])


def test_all_taxed_final_equals_net_when_already_all_rf():
    from core.config import BenchmarkParams
    from core.models import tax_projection

    pf = _single("rf_regressiva", g=0.12, monthly=1_000)
    bench = BenchmarkParams(capital=100_000, annual_rate=0.10)
    proj = tax_projection(pf, bench, horizon_years=5, ipca=0.0)
    assert proj["all_taxed_final"] == pytest.approx(
        float(simulate_portfolio(pf, 5).patrimony[-1])
    )


def test_all_taxed_final_below_net_for_exempt_portfolio():
    from core.config import BenchmarkParams
    from core.models import tax_projection

    pf = _single("isento", y=0.10)
    bench = BenchmarkParams(capital=100_000, annual_rate=0.10)
    proj = tax_projection(pf, bench, horizon_years=10, ipca=0.0)
    assert proj["all_taxed_final"] < float(simulate_portfolio(pf, 10).patrimony[-1])


def test_mc_draw_floor_prevents_sign_flip():
    pf = _single("rf_regressiva", g=0.0)
    pf.assets[0].volatility = 3.0   # absurd vol to force draws below -1
    mc = simulate_portfolio_mc(pf, 3, MonteCarloParams(n_trajectories=500, seed=3))
    assert (mc.trajectories > 0).all()   # strictly positive: -0.99 floor caps at near-total loss; -1.0 would zero forever
