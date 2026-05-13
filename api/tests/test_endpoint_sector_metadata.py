"""Smoke tests for GET /api/sector-metadata."""
from fastapi.testclient import TestClient

from main import app


def test_returns_200_with_sector_table():
    client = TestClient(app)
    response = client.get("/api/sector-metadata")
    assert response.status_code == 200
    body = response.json()
    assert "sectors" in body
    assert "count" in body
    assert body["source"] == "curated"


def test_well_known_tickers_classified():
    client = TestClient(app)
    body = client.get("/api/sector-metadata").json()
    sectors = body["sectors"]
    assert sectors["PETR4"] == "Petróleo & Gás"
    assert sectors["ITUB4"] == "Bancos"
    assert sectors["VALE3"] == "Mineração & Siderurgia"
    assert sectors["TAEE11"] == "Energia Elétrica"


def test_count_matches_keys():
    client = TestClient(app)
    body = client.get("/api/sector-metadata").json()
    assert body["count"] == len(body["sectors"])


def test_meta_key_not_exposed():
    client = TestClient(app)
    body = client.get("/api/sector-metadata").json()
    assert "_meta" not in body["sectors"]


def test_all_values_are_valid_sectors():
    """Every mapped value must belong to the canonical taxonomy."""
    client = TestClient(app)
    body = client.get("/api/sector-metadata").json()
    valid = {
        "Bancos", "Seguros", "Financeiro Outros",
        "Petróleo & Gás", "Mineração & Siderurgia", "Materiais Básicos",
        "Energia Elétrica", "Saneamento", "Telecomunicações", "Tecnologia",
        "Saúde", "Varejo & Consumo", "Alimentos & Bebidas",
        "Bens de Capital", "Construção", "Logística & Transporte", "Educação",
        "Imobiliário", "Internacional", "Diversificado", "Outros",
    }
    for ticker, sector in body["sectors"].items():
        assert sector in valid, f"{ticker} has invalid sector {sector}"


def test_minimum_coverage():
    """Sanity: curated table should have at least 80 tickers (we hand-curated ~100)."""
    client = TestClient(app)
    body = client.get("/api/sector-metadata").json()
    assert body["count"] >= 80
