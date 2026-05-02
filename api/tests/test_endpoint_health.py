"""Smoke tests for /api/health."""
from fastapi.testclient import TestClient

from main import app


def test_health_returns_200_and_payload():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok", "version": "1.0.0"}
