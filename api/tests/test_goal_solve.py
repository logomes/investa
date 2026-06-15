"""Tests for the Monte Carlo goal solver."""
from fastapi.testclient import TestClient

from core.config import AssetClass, PortfolioParams
from core.models import simulate_portfolio, solve_goal_contribution
from main import app

client = TestClient(app)


def _deterministic_portfolio() -> PortfolioParams:
    # volatility 0 → every MC trajectory equals the deterministic path
    return PortfolioParams(
        capital=100_000,
        monthly_contribution=0.0,
        contribution_inflation_indexed=False,
        assets=[AssetClass("A", 1.0, 0.10, 0.0, 0.0, volatility=0.0)],
    )


def test_returns_zero_when_goal_already_attainable():
    pf = _deterministic_portfolio()
    base_final = float(simulate_portfolio(pf, 10, reinvest_income=True).patrimony[-1])
    result = solve_goal_contribution(
        pf, horizon_years=10, goal_target=base_final * 0.9, confidence=0.8,
    )
    assert result["required_monthly_contribution"] == 0.0
    assert result["attainable"] is True
    assert result["achieved_probability"] == 1.0


def test_flags_unattainable_at_upper_bound():
    result = solve_goal_contribution(
        _deterministic_portfolio(),
        horizon_years=1, goal_target=100_000_000_000.0, confidence=0.8,
    )
    assert result["attainable"] is False
    assert result["required_monthly_contribution"] == 50_000.0


def test_finds_contribution_within_tolerance():
    from dataclasses import replace

    pf = _deterministic_portfolio()
    base_final = float(simulate_portfolio(pf, 10, reinvest_income=True).patrimony[-1])
    goal = base_final + 100_000.0
    result = solve_goal_contribution(pf, horizon_years=10, goal_target=goal, confidence=0.8)
    assert result["attainable"] is True
    assert result["achieved_probability"] >= 0.8
    c = result["required_monthly_contribution"]
    assert c > 0

    # the returned contribution achieves the goal…
    achieved = float(
        simulate_portfolio(replace(pf, monthly_contribution=c), 10, reinvest_income=True).patrimony[-1]
    )
    assert achieved >= goal
    # …and meaningfully less does not (i.e. the answer is tight)
    short = float(
        simulate_portfolio(replace(pf, monthly_contribution=max(c - 100, 0)), 10, reinvest_income=True).patrimony[-1]
    )
    assert short < goal


def test_higher_confidence_requires_more_contribution():
    pf = _deterministic_portfolio()
    pf.assets[0].volatility = 0.15
    low = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.5)
    high = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.9)
    assert high["required_monthly_contribution"] >= low["required_monthly_contribution"]
    for r, conf in ((low, 0.5), (high, 0.9)):
        if r["attainable"]:
            assert r["achieved_probability"] >= conf


def test_is_reproducible():
    pf = _deterministic_portfolio()
    pf.assets[0].volatility = 0.15  # stochastic now; seed must pin the answer
    a = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.8)
    b = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.8)
    assert a == b


def _payload(**overrides) -> dict:
    base = {
        "horizon": 10,
        "goalTarget": 500_000,
        "portfolio": {
            "capital": 100_000,
            "monthlyContribution": 0,
            "contributionInflationIndexed": False,
            "assets": [{
                "name": "A", "weight": 1.0, "expectedYield": 0.10,
                "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.10,
            }],
        },
    }
    base.update(overrides)
    return base


def test_endpoint_solves():
    resp = client.post("/api/goal/solve", json=_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {
        "requiredMonthlyContribution", "achievedProbability", "attainable", "iterations",
    }
    assert body["requiredMonthlyContribution"] >= 0


def test_endpoint_validates_confidence_bounds():
    resp = client.post("/api/goal/solve", json=_payload(confidence=0.3))
    assert resp.status_code == 422


def test_solver_targets_net_of_redemption():
    # rf_regressiva, g=0.10, h=8, no contributions:
    #   gross = 100k × 1.10^8 ≈ 214_358.88
    #   exit tax = 0.15 × (214_358.88 − 100_000) ≈ 17_153.83
    #   net ≈ 197_205.05
    # Goal of 260_000 (net) is above the zero-contribution net final → requires c > 0.
    from dataclasses import replace

    pf = PortfolioParams(
        capital=100_000, monthly_contribution=0.0,
        contribution_inflation_indexed=False,
        assets=[AssetClass("RF", 1.0, expected_yield=0.0, capital_gain=0.10,
                           volatility=0.0, tax_profile="rf_regressiva")],
    )
    goal = 260_000.0
    result = solve_goal_contribution(pf, horizon_years=8, goal_target=goal, confidence=0.8)
    assert result["attainable"] is True
    c = result["required_monthly_contribution"]
    assert c > 0  # goal is above zero-contribution net final (~197_205)
    achieved_net = float(
        simulate_portfolio(replace(pf, monthly_contribution=c), 8).patrimony[-1]
    )
    assert achieved_net >= goal  # solver solves in NET space
