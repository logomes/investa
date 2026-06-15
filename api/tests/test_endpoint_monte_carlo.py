"""Tests for POST /api/simulate/monte-carlo."""
from fastapi.testclient import TestClient

from main import app


def _payload() -> dict:
    return {
        "horizon": 5,
        "portfolio": {
            "capital": 230_000.0, "monthlyContribution": 0.0,
            "contributionInflationIndexed": True,
            "assets": [
                {"name": "FIIs", "weight": 1.0, "expectedYield": 0.10,
                 "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.15},
            ],
        },
        "mc": {"nTrajectories": 500, "seed": 42, "targetPatrimony": 0.0},
    }


def test_monte_carlo_returns_portfolio_result():
    client = TestClient(app)
    response = client.post("/api/simulate/monte-carlo", json=_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert "portfolio" in body
    assert "realEstate" not in body


def test_monte_carlo_portfolio_has_percentile_arrays():
    client = TestClient(app)
    body = client.post("/api/simulate/monte-carlo", json=_payload()).json()
    result = body["portfolio"]
    assert len(result["p10"]) == 6
    assert len(result["p50"]) == 6
    assert len(result["p90"]) == 6
    # final_distribution has nTrajectories elements
    assert len(result["finalDistribution"]) == 500
    assert len(result["maxDrawdowns"]) == 500


def test_monte_carlo_with_seed_is_deterministic():
    client = TestClient(app)
    body1 = client.post("/api/simulate/monte-carlo", json=_payload()).json()
    body2 = client.post("/api/simulate/monte-carlo", json=_payload()).json()
    assert body1["portfolio"]["p50"] == body2["portfolio"]["p50"]
