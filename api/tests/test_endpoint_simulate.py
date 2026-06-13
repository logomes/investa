"""Tests for POST /api/simulate."""
from fastapi.testclient import TestClient

from main import app
from routers.simulation import _benchmark_label
from schemas.inputs import BenchmarkInput


def _default_payload() -> dict:
    """Minimal valid payload mirroring the default scenario."""
    return {
        "capital": 230_000.0,
        "horizon": 10,
        "reinvest": True,
        "portfolio": {
            "capital": 230_000.0,
            "monthlyContribution": 0.0,
            "contributionInflationIndexed": True,
            "assets": [
                {"name": "FIIs Papel", "weight": 0.25, "expectedYield": 0.130,
                 "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.14},
                {"name": "FIIs Tijolo", "weight": 0.25, "expectedYield": 0.090,
                 "capitalGain": 0.02, "taxRate": 0.0, "note": "", "volatility": 0.16},
                {"name": "Ações BR", "weight": 0.20, "expectedYield": 0.090,
                 "capitalGain": 0.03, "taxRate": 0.0, "note": "", "volatility": 0.27},
                {"name": "Aristocrats", "weight": 0.15, "expectedYield": 0.040,
                 "capitalGain": 0.06, "taxRate": 0.30, "note": "", "volatility": 0.18},
                {"name": "Tesouro IPCA+", "weight": 0.15, "expectedYield": 0.115,
                 "capitalGain": 0.0, "taxRate": 0.10, "note": "", "volatility": 0.05},
            ],
        },
        "benchmark": {"kind": "cdi", "annualRate": 0.1465, "taxRate": 0.175},
    }


def test_simulate_returns_full_output_shape():
    client = TestClient(app)
    response = client.post("/api/simulate", json=_default_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert "portfolio" in body
    assert "benchmark" in body
    assert "sensitivity" in body
    assert "taxProjection" in body
    assert "taxComparison" not in body
    assert "realEstate" not in body


def test_simulate_yearly_arrays_have_horizon_plus_one_points():
    payload = _default_payload()
    payload["horizon"] = 5
    client = TestClient(app)
    body = client.post("/api/simulate", json=payload).json()
    assert len(body["portfolio"]["years"]) == 6  # 0..5 inclusive
    assert len(body["portfolio"]["patrimony"]) == 6
    assert len(body["benchmark"]["patrimony"]) == 6


def test_simulate_rejects_invalid_horizon():
    payload = _default_payload()
    payload["horizon"] = 100  # > 30
    client = TestClient(app)
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 422  # Pydantic validation error


def test_benchmark_label_canonical_pt_br():
    cdi = BenchmarkInput(kind="cdi", annual_rate=0.1465, tax_rate=0.175)
    assert _benchmark_label(cdi) == "CDI (líquido)"

    selic = BenchmarkInput(kind="selic", annual_rate=0.1475, tax_rate=0.175)
    assert _benchmark_label(selic) == "Selic (líquido)"

    ipca = BenchmarkInput(kind="ipca_plus", annual_rate=0.16, tax_rate=0.175, ipca_spread=0.06)
    assert _benchmark_label(ipca) == "IPCA + 6,0% (líquido)"


def test_simulate_sensitivity_uses_portfolio_tornado():
    client = TestClient(app)
    resp = client.post("/api/simulate", json=_default_payload())
    assert resp.status_code == 200
    rows = resp.json()["sensitivity"]
    assert len(rows) == 4
    assert {r["parameter"] for r in rows} == {
        "Yield da carteira (±1,5pp)",
        "Ganho de capital (±1,5pp)",
        "Aporte mensal (±25%)",
        "Horizonte (−2a / +2a)",
    }


def test_simulate_returns_tax_projection_and_result_tax_fields():
    client = TestClient(app)
    resp = client.post("/api/simulate", json=_default_payload())
    body = resp.json()
    assert "taxProjection" in body and "taxComparison" not in body
    tp = body["taxProjection"]
    assert {"rows", "taxPaidByYear", "exitTaxByYear", "allTaxedFinal"} <= set(tp)
    assert {"name", "taxProfile", "taxPaidPath", "exitTax", "netFinal", "grossFinal"} <= set(tp["rows"][0])
    for key in ("grossPatrimony", "taxPaidCumulative", "exitTax"):
        assert key in body["portfolio"] and key in body["benchmark"]


def test_sensitivity_has_horizonte_row_not_ir():
    client = TestClient(app)
    rows = client.post("/api/simulate", json=_default_payload()).json()["sensitivity"]
    labels = {r["parameter"] for r in rows}
    assert "Horizonte (−2a / +2a)" in labels
    assert not any("IR efetivo" in l for l in labels)
