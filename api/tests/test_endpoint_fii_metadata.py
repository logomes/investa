"""Smoke tests for GET /api/fii-metadata."""
from fastapi.testclient import TestClient

from main import app


def test_returns_200_with_subtype_table():
    client = TestClient(app)
    response = client.get("/api/fii-metadata")
    assert response.status_code == 200
    body = response.json()
    assert "subtypes" in body
    assert "count" in body
    assert body["source"] == "curated"


def test_well_known_tickers_classified():
    client = TestClient(app)
    body = client.get("/api/fii-metadata").json()
    subtypes = body["subtypes"]
    assert subtypes["MXRF11"] == "papel"
    assert subtypes["HGLG11"] == "tijolo"
    assert subtypes["RURA11"] == "agro"
    assert subtypes["BCFF11"] == "fof"


def test_count_matches_keys():
    client = TestClient(app)
    body = client.get("/api/fii-metadata").json()
    assert body["count"] == len(body["subtypes"])


def test_meta_key_not_exposed():
    """Internal `_meta` block should be stripped from the public payload."""
    client = TestClient(app)
    body = client.get("/api/fii-metadata").json()
    assert "_meta" not in body["subtypes"]


def test_all_values_are_valid_subtypes():
    client = TestClient(app)
    body = client.get("/api/fii-metadata").json()
    valid = {"papel", "tijolo", "agro", "fof", "hibrido"}
    for ticker, subtype in body["subtypes"].items():
        assert subtype in valid, f"{ticker} has invalid subtype {subtype}"
