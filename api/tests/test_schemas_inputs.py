"""Tests for Pydantic input schemas (camelCase API contract)."""
import pytest
from pydantic import ValidationError

from schemas.inputs import (
    BenchmarkInput,
    FinancingInput,
    FixedIncomePositionInput,
    FixedIncomeSimulateInput,
    MonteCarloInput,
    PortfolioAssetInput,
    PortfolioInput,
    RealEstateInput,
    SimulateInput,
    SimulateMonteCarloInput,
)


def test_simulate_input_accepts_camelcase_payload():
    payload = {
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
                {"name": "FIIs", "weight": 1.0, "expectedYield": 0.10,
                 "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.15},
            ],
        },
        "benchmark": {"selicRate": 0.1475, "taxRate": 0.175},
    }
    parsed = SimulateInput.model_validate(payload)
    assert parsed.capital == 230_000.0
    assert parsed.real_estate.monthly_rent == 1_500.0
    assert parsed.portfolio.assets[0].expected_yield == 0.10
    assert parsed.benchmark.selic_rate == 0.1475


def test_simulate_input_rejects_horizon_out_of_range():
    payload = {
        "capital": 100_000.0, "horizon": 50, "reinvest": True,
        "realEstate": {"propertyValue": 100_000, "monthlyRent": 0,
                       "annualAppreciation": 0, "iptuRate": 0,
                       "vacancyMonthsPerYear": 0, "managementFeePct": 0,
                       "maintenanceAnnual": 0, "insuranceAnnual": 0,
                       "incomeTaxBracket": 0, "acquisitionCostPct": 0,
                       "appreciationVolatility": 0, "financing": None},
        "portfolio": {"capital": 100_000, "monthlyContribution": 0,
                      "contributionInflationIndexed": True, "assets": []},
        "benchmark": {"selicRate": 0.10, "taxRate": 0.15},
    }
    with pytest.raises(ValidationError, match="horizon"):
        SimulateInput.model_validate(payload)


def test_fixed_income_position_input_parses_iso_dates():
    payload = {
        "name": "LCI Banco X",
        "initialAmount": 30_000.0,
        "purchaseDate": "2025-03-15",
        "indexer": "cdi",
        "rate": 0.95,
        "maturityDate": "2027-03-15",
        "isTaxExempt": True,
    }
    parsed = FixedIncomePositionInput.model_validate(payload)
    assert parsed.indexer == "cdi"
    assert str(parsed.purchase_date) == "2025-03-15"
    assert parsed.is_tax_exempt is True


def test_fixed_income_position_input_rejects_invalid_indexer():
    with pytest.raises(ValidationError, match="indexer"):
        FixedIncomePositionInput.model_validate({
            "name": "X", "initialAmount": 1000, "purchaseDate": "2025-01-01",
            "indexer": "bitcoin", "rate": 0.1,
        })
