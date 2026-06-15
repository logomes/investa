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
        "Horizonte (−2a / +2a)",
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


def test_horizonte_row_optimistic_geq_pessimistic():
    # Longer horizon always beats shorter for positive-return portfolios.
    df = sensitivity_portfolio(_params(), horizon_years=10)
    row = df[df["Parâmetro"] == "Horizonte (−2a / +2a)"].iloc[0]
    assert row["Cenário Otimista"] >= row["Cenário Pessimista"]


def test_horizonte_row_clamps_to_valid_range():
    # horizon=2 → pessimistic clips to max(2-2, 1)=1 yr; no crash.
    df = sensitivity_portfolio(_params(), horizon_years=2)
    row = df[df["Parâmetro"] == "Horizonte (−2a / +2a)"].iloc[0]
    assert row["Cenário Pessimista"] > 0
    assert row["Cenário Otimista"] > row["Cenário Pessimista"]
