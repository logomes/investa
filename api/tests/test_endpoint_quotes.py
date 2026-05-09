"""Tests for GET /api/quotes."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from core.data_sources.quotes import Quote
from core.services.quotes import clear_cache
from main import app


def setup_function(_func):
    clear_cache()


def test_quote_returns_200_with_camel_case_payload(mocker):
    fake = Quote(
        price=45.67,
        currency="BRL",
        as_of=datetime(2026, 5, 9, 10, 30, tzinfo=timezone.utc),
        source="brapi",
    )
    mocker.patch("routers.quotes.get_quote", return_value=fake)
    client = TestClient(app)
    response = client.get("/api/quotes", params={"ticker": "PETR4", "market": "BR"})
    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "PETR4"
    assert body["market"] == "BR"
    assert body["price"] == 45.67
    assert body["currency"] == "BRL"
    assert body["source"] == "brapi"
    assert body["asOf"].startswith("2026-05-09T10:30")


def test_quote_returns_404_when_chain_returns_none(mocker):
    mocker.patch("routers.quotes.get_quote", return_value=None)
    client = TestClient(app)
    response = client.get("/api/quotes", params={"ticker": "ZZZZ", "market": "BR"})
    assert response.status_code == 404


def test_quote_returns_422_for_invalid_market():
    client = TestClient(app)
    response = client.get("/api/quotes", params={"ticker": "PETR4", "market": "XX"})
    assert response.status_code == 422


def test_quote_returns_422_for_invalid_ticker_format():
    client = TestClient(app)
    response = client.get("/api/quotes", params={"ticker": "PETR4!", "market": "BR"})
    assert response.status_code == 422


def test_quote_uppercases_ticker_in_response(mocker):
    fake = Quote(price=1.0, currency="USD", as_of=datetime(2026, 5, 9, tzinfo=timezone.utc), source="yahoo")
    mocker.patch("routers.quotes.get_quote", return_value=fake)
    client = TestClient(app)
    response = client.get("/api/quotes", params={"ticker": "aapl", "market": "US"})
    assert response.status_code == 200
    assert response.json()["ticker"] == "AAPL"
