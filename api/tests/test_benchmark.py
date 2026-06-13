"""Tests for the generalized passive benchmark (CDI/Selic/IPCA+x)."""
import numpy as np
import pytest

from core.config import AssetClass, BenchmarkParams, PortfolioParams, regressive_rate
from core.models import annual_tax_comparison, simulate_benchmark


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


def test_benchmark_invariant_net_gross_exit():
    params = BenchmarkParams(capital=50_000, annual_rate=0.12, monthly_contribution=500)
    r = simulate_benchmark(params, horizon_years=8, ipca=0.05)
    np.testing.assert_allclose(r.patrimony, r.gross_patrimony - r.exit_tax)


def test_label_propagates_to_result():
    params = BenchmarkParams(capital=10_000, annual_rate=0.10, label="CDI (líquido)")
    result = simulate_benchmark(params, horizon_years=1)
    assert result.label == "CDI (líquido)"


def test_rejects_non_positive_horizon():
    with pytest.raises(ValueError):
        simulate_benchmark(BenchmarkParams(), horizon_years=0)


def test_benchmark_annual_income_excludes_contributions():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10,
                             monthly_contribution=2_000, contribution_inflation_indexed=False)
    r = simulate_benchmark(params, horizon_years=3)
    # year-1 income: net growth minus the 24k aporte — strictly less than the aporte itself
    assert r.annual_income[1] < 24_000 * 0.5
    # and roughly the net yield on capital (+ the aporte's first-year growth share)
    assert r.annual_income[1] > 0


def test_benchmark_year0_income_anchor_matches_year1_bracket():
    params = BenchmarkParams(capital=100_000, annual_rate=0.10)
    r = simulate_benchmark(params, horizon_years=5)
    assert r.annual_income[0] == pytest.approx(100_000 * 0.10 * (1 - 0.175))
    # no dip: year-1 income equals the anchor for a lump sum
    assert r.annual_income[1] == pytest.approx(r.annual_income[0], rel=1e-9)


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
