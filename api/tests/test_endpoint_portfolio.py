"""Tests for /api/portfolio/defaults."""
from fastapi.testclient import TestClient

from main import app


def test_defaults_includes_all_three_param_groups():
    client = TestClient(app)
    response = client.get("/api/portfolio/defaults")
    assert response.status_code == 200
    body = response.json()
    assert "realEstate" in body
    assert "portfolio" in body
    assert "benchmark" in body


def test_defaults_real_estate_has_expected_fields():
    client = TestClient(app)
    body = client.get("/api/portfolio/defaults").json()
    re = body["realEstate"]
    assert "propertyValue" in re
    assert "monthlyRent" in re
    assert "annualAppreciation" in re
    assert isinstance(re["propertyValue"], (int, float))
    assert re["propertyValue"] > 0


def test_defaults_portfolio_assets_sum_to_one():
    client = TestClient(app)
    body = client.get("/api/portfolio/defaults").json()
    weights = [a["weight"] for a in body["portfolio"]["assets"]]
    assert abs(sum(weights) - 1.0) < 1e-6
