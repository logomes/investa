"""Tests for POST /api/simulate."""
from fastapi.testclient import TestClient

from main import app


def _default_payload() -> dict:
    """Minimal valid payload mirroring the default scenario."""
    return {
        "capital": 230_000.0,
        "horizon": 10,
        "reinvest": True,
        "realEstate": {
            "propertyValue": 230_000.0,
            "monthlyRent": 1_500.0,
            "annualAppreciation": 0.055,
            "iptuRate": 0.010,
            "vacancyMonthsPerYear": 1.0,
            "managementFeePct": 0.10,
            "maintenanceAnnual": 900.0,
            "insuranceAnnual": 600.0,
            "incomeTaxBracket": 0.075,
            "acquisitionCostPct": 0.05,
            "appreciationVolatility": 0.10,
            "financing": None,
        },
        "portfolio": {
            "capital": 230_000.0,
            "monthlyContribution": 0.0,
            "contributionInflationIndexed": True,
            "assets": [
                {"name": "FIIs Papel", "weight": 0.25, "expectedYield": 0.130,
                 "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.14},
                {"name": "FIIs Tijolo", "weight": 0.25, "expectedYield": 0.090,
                 "capitalGain": 0.02, "taxRate": 0.0, "note": "", "volatility": 0.16},
                {"name": "Ações BR", "weight": 0.20, "expectedYield": 0.090,
                 "capitalGain": 0.03, "taxRate": 0.0, "note": "", "volatility": 0.27},
                {"name": "Aristocrats", "weight": 0.15, "expectedYield": 0.040,
                 "capitalGain": 0.06, "taxRate": 0.30, "note": "", "volatility": 0.18},
                {"name": "Tesouro IPCA+", "weight": 0.15, "expectedYield": 0.115,
                 "capitalGain": 0.0, "taxRate": 0.10, "note": "", "volatility": 0.05},
            ],
        },
        "benchmark": {"selicRate": 0.1475, "taxRate": 0.175},
    }


def test_simulate_returns_full_output_shape():
    client = TestClient(app)
    response = client.post("/api/simulate", json=_default_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert "realEstate" in body
    assert "portfolio" in body
    assert "benchmark" in body
    assert "sensitivity" in body
    assert "taxComparison" in body


def test_simulate_yearly_arrays_have_horizon_plus_one_points():
    payload = _default_payload()
    payload["horizon"] = 5
    client = TestClient(app)
    body = client.post("/api/simulate", json=payload).json()
    assert len(body["realEstate"]["years"]) == 6  # 0..5 inclusive
    assert len(body["realEstate"]["patrimony"]) == 6
    assert len(body["portfolio"]["patrimony"]) == 6


def test_simulate_rejects_invalid_horizon():
    payload = _default_payload()
    payload["horizon"] = 100  # > 30
    client = TestClient(app)
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 422  # Pydantic validation error
