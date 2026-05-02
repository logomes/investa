"""Tests for /api/macro."""
from unittest.mock import patch

from fastapi.testclient import TestClient

from core.config import MACRO_FALLBACK
from core.services.macro import clear_cache
from main import app


def setup_function(_func):
    """Reset cache before each test."""
    clear_cache()


def test_macro_returns_live_payload_when_bcb_succeeds(mocker):
    fake = MACRO_FALLBACK
    mocker.patch("routers.macro.get_macro_params", return_value=fake)
    client = TestClient(app)
    response = client.get("/api/macro")
    assert response.status_code == 200
    body = response.json()
    assert body["selic"] == fake.selic
    assert body["cdi"] == fake.cdi
    assert body["ipca"] == fake.ipca
    assert "isStale" in body  # camelCase
    assert "sourceLabel" in body


def test_macro_returns_fallback_payload_when_bcb_fails():
    """If BcbApiError is raised, get_macro_params returns MACRO_FALLBACK with isStale=True."""
    from core.data_sources.bcb import BcbApiError
    with patch("core.services.macro.fetch_macro", side_effect=BcbApiError("down")):
        client = TestClient(app)
        response = client.get("/api/macro")
        assert response.status_code == 200
        body = response.json()
        assert body["isStale"] is True
        assert "Fallback" in body["sourceLabel"]
