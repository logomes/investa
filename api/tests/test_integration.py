"""End-to-end flow tests across multiple endpoints.

These check cross-endpoint invariants that unit tests miss:
- shape compatibility (defaults round-trip through simulate)
- statistical coherence (deterministic sim sits within MC distribution)
- physical coherence (debt amortizes when financing is enabled)
- determinism (seeded MC repeats; same payload twice = same response)
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def _base_simulate_payload() -> dict:
    return {
        "capital": 230_000.0,
        "horizon": 10,
        "reinvest": True,
        "realEstate": {
            "propertyValue": 230_000.0,
            "monthlyRent": 1_500.0,
            "annualAppreciation": 0.055,
            "iptuRate": 0.010,
            "vacancyMonthsPerYear": 1.0,
            "managementFeePct": 0.10,
            "maintenanceAnnual": 900.0,
            "insuranceAnnual": 600.0,
            "incomeTaxBracket": 0.075,
            "acquisitionCostPct": 0.05,
            "appreciationVolatility": 0.10,
            "financing": None,
        },
        "portfolio": {
            "capital": 230_000.0,
            "monthlyContribution": 0.0,
            "contributionInflationIndexed": True,
            "assets": [
                {"name": "Mix", "weight": 1.0, "expectedYield": 0.10,
                 "capitalGain": 0.02, "taxRate": 0.0, "note": "", "volatility": 0.15},
            ],
        },
        "benchmark": {"selicRate": 0.1475, "taxRate": 0.175},
    }


def _mc_payload_from_simulate(simulate_payload: dict, seed: int = 42, n: int = 1000) -> dict:
    """Build a /api/simulate/monte-carlo payload that matches a simulate input."""
    return {
        "horizon": simulate_payload["horizon"],
        "realEstate": simulate_payload["realEstate"],
        "portfolio": simulate_payload["portfolio"],
        "mc": {"nTrajectories": n, "seed": seed, "targetPatrimony": 0.0},
    }


def test_simulate_median_falls_within_monte_carlo_band():
    """The deterministic /simulate output for the portfolio should sit inside
    the MC p10..p90 band at the final horizon — they share the same engine,
    so any mismatch points at a regression in either path."""
    client = TestClient(app)
    payload = _base_simulate_payload()

    sim = client.post("/api/simulate", json=payload).json()
    mc = client.post("/api/simulate/monte-carlo", json=_mc_payload_from_simulate(payload)).json()

    sim_final = sim["portfolio"]["patrimony"][-1]
    p10_final = mc["portfolio"]["p10"][-1]
    p90_final = mc["portfolio"]["p90"][-1]

    # Allow a small slack on each end — MC with 1k trajectories has noise.
    assert p10_final * 0.85 <= sim_final <= p90_final * 1.15, (
        f"sim={sim_final:.0f} outside [p10={p10_final:.0f} × 0.85, p90={p90_final:.0f} × 1.15]"
    )


def test_defaults_round_trip_through_simulate():
    """GET /api/portfolio/defaults must produce a payload that /api/simulate
    accepts without modification — protects against schema drift."""
    client = TestClient(app)
    defaults = client.get("/api/portfolio/defaults").json()

    payload = {
        "capital": defaults["portfolio"]["capital"],
        "horizon": 10,
        "reinvest": True,
        "realEstate": defaults["realEstate"],
        "portfolio": defaults["portfolio"],
        "benchmark": defaults["benchmark"],
    }

    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200, response.text


def test_financing_scenario_produces_decreasing_debt_balance():
    """When financing is on, the debtBalance array must decrease monotonically
    (modulo the very first amortization) and reach near-zero by the end of
    the financing term."""
    client = TestClient(app)
    payload = _base_simulate_payload()
    payload["realEstate"]["financing"] = {
        "termYears": 10,
        "annualRate": 0.10,
        "entryPct": 0.20,
        "system": "SAC",
        "monthlyInsuranceRate": 0.0005,
    }
    payload["horizon"] = 10

    sim = client.post("/api/simulate", json=payload).json()
    debt = sim["realEstate"].get("debtBalance")
    assert debt is not None, "financing scenario should populate debtBalance"
    assert len(debt) == 11

    # Strictly decreasing year over year (or equal at the floor of zero).
    for prev, cur in zip(debt, debt[1:]):
        assert cur <= prev + 1e-6, f"debt grew from {prev} to {cur}"

    # By the end of the financing term debt should be near zero.
    assert debt[-1] < 1.0


def test_seeded_monte_carlo_is_deterministic_across_repeated_calls():
    """Same payload + same seed must return byte-identical percentile arrays
    on repeated calls — protects against accidental nondeterminism in the
    MC pipeline (e.g. unsorted dict iteration leaking into RNG state)."""
    client = TestClient(app)
    payload = _mc_payload_from_simulate(_base_simulate_payload(), seed=42, n=500)

    a = client.post("/api/simulate/monte-carlo", json=payload).json()
    b = client.post("/api/simulate/monte-carlo", json=payload).json()

    assert a["portfolio"]["p50"] == b["portfolio"]["p50"]
    assert a["portfolio"]["finalDistribution"] == b["portfolio"]["finalDistribution"]
    assert a["realEstate"]["maxDrawdowns"] == b["realEstate"]["maxDrawdowns"]


def test_simulate_is_idempotent_for_identical_payload():
    """Same simulate payload twice must produce identical output — no hidden
    randomness should leak into the deterministic path."""
    client = TestClient(app)
    payload = _base_simulate_payload()

    a = client.post("/api/simulate", json=payload).json()
    b = client.post("/api/simulate", json=payload).json()

    assert a["portfolio"]["patrimony"] == b["portfolio"]["patrimony"]
    assert a["realEstate"]["patrimony"] == b["realEstate"]["patrimony"]
    assert a["benchmark"]["patrimony"] == b["benchmark"]["patrimony"]


def test_changing_horizon_changes_array_length_consistently():
    """Both /simulate and /simulate/monte-carlo must agree on horizon → arrays
    of length horizon+1. Catches off-by-one regressions in either path."""
    client = TestClient(app)
    payload = _base_simulate_payload()
    payload["horizon"] = 5

    sim = client.post("/api/simulate", json=payload).json()
    mc = client.post("/api/simulate/monte-carlo", json=_mc_payload_from_simulate(payload)).json()

    assert len(sim["portfolio"]["patrimony"]) == 6
    assert len(mc["portfolio"]["p50"]) == 6
    assert len(mc["realEstate"]["p50"]) == 6
