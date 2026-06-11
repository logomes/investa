"""Tests for /api/portfolio/defaults."""
from fastapi.testclient import TestClient

from main import app


def test_defaults_includes_portfolio_and_benchmark():
    client = TestClient(app)
    response = client.get("/api/portfolio/defaults")
    assert response.status_code == 200
    body = response.json()
    assert "portfolio" in body
    assert "benchmark" in body
    assert "realEstate" not in body


def test_defaults_portfolio_assets_sum_to_one():
    client = TestClient(app)
    body = client.get("/api/portfolio/defaults").json()
    weights = [a["weight"] for a in body["portfolio"]["assets"]]
    assert abs(sum(weights) - 1.0) < 1e-6
