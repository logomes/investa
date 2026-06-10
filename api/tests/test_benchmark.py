"""Tests for the generalized passive benchmark (CDI/Selic/IPCA+x)."""
import numpy as np
import pytest

from core.config import AssetClass, BenchmarkParams, PortfolioParams
from core.models import annual_tax_comparison, simulate_benchmark


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


def test_contributions_compound_from_begin_of_year():
    # capital 0, 10% net rate: a begin-of-year aporte of 12k must earn the
    # full year's return — 13_200, not the PMT-end 12_000.
    params = BenchmarkParams(
        capital=0.0, annual_rate=0.10, tax_rate=0.0,
        monthly_contribution=1_000, contribution_inflation_indexed=False,
    )
    result = simulate_benchmark(params, horizon_years=1)
    assert result.patrimony[1] == pytest.approx(13_200)


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
