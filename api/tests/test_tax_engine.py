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
