"""Tests for POST /api/simulate/monte-carlo."""
from fastapi.testclient import TestClient

from main import app


def _payload() -> dict:
    return {
        "horizon": 5,
        "realEstate": {
            "propertyValue": 230_000.0, "monthlyRent": 1500.0,
            "annualAppreciation": 0.055, "iptuRate": 0.010,
            "vacancyMonthsPerYear": 1.0, "managementFeePct": 0.10,
            "maintenanceAnnual": 900.0, "insuranceAnnual": 600.0,
            "incomeTaxBracket": 0.075, "acquisitionCostPct": 0.05,
            "appreciationVolatility": 0.10, "financing": None,
        },
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


def test_monte_carlo_returns_two_results():
    client = TestClient(app)
    response = client.post("/api/simulate/monte-carlo", json=_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert "realEstate" in body
    assert "portfolio" in body


def test_monte_carlo_each_result_has_percentile_arrays():
    client = TestClient(app)
    body = client.post("/api/simulate/monte-carlo", json=_payload()).json()
    for key in ("realEstate", "portfolio"):
        result = body[key]
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
    assert body1["realEstate"]["p50"] == body2["realEstate"]["p50"]
