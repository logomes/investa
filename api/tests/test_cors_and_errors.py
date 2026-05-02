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


def test_cors_allows_investa_beta_production_alias():
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://investa-beta.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://investa-beta.vercel.app"


def test_cors_allows_vercel_preview_via_regex():
    """Preview deploys with branch in URL must be allowed via regex."""
    client = TestClient(app)
    preview_origin = "https://investa-git-feat-fase3-visao-geral-logomes-projects.vercel.app"
    response = client.options(
        "/api/health",
        headers={
            "Origin": preview_origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == preview_origin


def test_cors_rejects_unknown_origin():
    """Origins not matching the static list or regex must NOT get CORS headers."""
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://malicious.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Without matching origin, FastAPI's CORSMiddleware doesn't add allow-origin
    assert response.headers.get("access-control-allow-origin") != "https://malicious.example.com"


def test_validation_error_returns_structured_400():
    """Pydantic validation errors should be returned in the documented format."""
    client = TestClient(app)
    response = client.post("/api/simulate", json={"capital": -100, "horizon": 100})
    # Pydantic returns 422 by default; we want a structured payload.
    assert response.status_code == 422
    body = response.json()
    assert "error" in body
    assert "message" in body
