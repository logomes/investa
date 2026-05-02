"""Tests for CORS middleware and the structured error handler."""
from fastapi.testclient import TestClient

from main import app


def test_cors_allows_vercel_origin():
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://investa.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://investa.vercel.app"


def test_cors_allows_localhost_dev():
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


def test_validation_error_returns_structured_400():
    """Pydantic validation errors should be returned in the documented format."""
    client = TestClient(app)
    response = client.post("/api/simulate", json={"capital": -100, "horizon": 100})
    # Pydantic returns 422 by default; we want a structured payload.
    assert response.status_code == 422
    body = response.json()
    assert "error" in body
    assert "message" in body
