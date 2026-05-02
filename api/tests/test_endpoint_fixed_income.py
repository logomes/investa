"""Tests for POST /api/fixed-income/simulate."""
from fastapi.testclient import TestClient

from main import app


def test_fixed_income_simulate_returns_projection_per_position():
    payload = {
        "horizonYears": 3,
        "startDate": "2025-01-01",
        "positions": [
            {"name": "LCI X", "initialAmount": 30000, "purchaseDate": "2025-01-01",
             "indexer": "cdi", "rate": 0.95, "isTaxExempt": True},
            {"name": "Prefixado Y", "initialAmount": 20000, "purchaseDate": "2025-01-01",
             "indexer": "prefixado", "rate": 0.12, "isTaxExempt": False},
        ],
    }
    client = TestClient(app)
    response = client.post("/api/fixed-income/simulate", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["projections"]) == 2
    assert body["totalInitial"] == 50000.0
    assert len(body["totalGross"]) == 4  # horizon + 1
    assert len(body["totalNet"]) == 4
    assert body["projections"][0]["name"] == "LCI X"
    assert body["projections"][0]["indexer"] == "cdi"


def test_fixed_income_simulate_rejects_invalid_indexer():
    payload = {
        "horizonYears": 3,
        "positions": [
            {"name": "X", "initialAmount": 1000, "purchaseDate": "2025-01-01",
             "indexer": "bitcoin", "rate": 0.1, "isTaxExempt": False},
        ],
    }
    client = TestClient(app)
    response = client.post("/api/fixed-income/simulate", json=payload)
    assert response.status_code == 422


def test_fixed_income_simulate_empty_positions_returns_empty_projection():
    payload = {"horizonYears": 3, "positions": []}
    client = TestClient(app)
    response = client.post("/api/fixed-income/simulate", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["projections"] == []
    assert body["totalInitial"] == 0.0
