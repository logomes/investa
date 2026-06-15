"""expected_inflation: scenario-level inflation overriding the server macro."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _simulate_payload(**overrides) -> dict:
    base = {
        "capital": 100_000.0,
        "horizon": 5,
        "reinvest": True,
        "portfolio": {
            "capital": 100_000.0,
            "monthlyContribution": 1_000.0,
            "contributionInflationIndexed": True,
            "assets": [{
                "name": "A", "weight": 1.0, "expectedYield": 0.10,
                "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.10,
            }],
        },
        "benchmark": {"kind": "cdi", "annualRate": 0.10, "taxRate": 0.175},
    }
    base.update(overrides)
    return base


def test_simulate_accepts_and_honors_expected_inflation():
    lo = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.0)).json()
    hi = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.20)).json()
    # indexed contributions grow with inflation → higher final patrimony
    assert hi["portfolio"]["patrimony"][-1] > lo["portfolio"]["patrimony"][-1]


def test_simulate_without_field_still_works():
    resp = client.post("/api/simulate", json=_simulate_payload())
    assert resp.status_code == 200


def test_simulate_rejects_out_of_range_inflation():
    resp = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.9))
    assert resp.status_code == 422


def test_monte_carlo_accepts_expected_inflation():
    payload = {
        "horizon": 5,
        "portfolio": _simulate_payload()["portfolio"],
        "mc": {"nTrajectories": 200, "seed": 1, "targetPatrimony": 0},
        "expectedInflation": 0.10,
    }
    resp = client.post("/api/simulate/monte-carlo", json=payload)
    assert resp.status_code == 200


def test_goal_solve_accepts_expected_inflation():
    payload = {
        "horizon": 5,
        "goalTarget": 500_000,
        "portfolio": _simulate_payload()["portfolio"],
        "expectedInflation": 0.10,
    }
    resp = client.post("/api/goal/solve", json=payload)
    assert resp.status_code == 200
