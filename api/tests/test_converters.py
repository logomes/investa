"""Tests for converters (ndarray → list)."""
from datetime import date

import numpy as np

from core.config import FixedIncomePosition, MacroParams
from core.models import simulate_fixed_income
from converters import (
    fixed_income_portfolio_to_dto,
    fixed_income_projection_to_dto,
    simulation_result_to_dto,
)


def test_simulation_result_dto_converts_arrays_to_lists():
    """Build a SimulationResult by hand and convert."""
    from core.models import SimulationResult
    r = SimulationResult(
        years=np.arange(4),
        patrimony=np.array([1000.0, 1100.0, 1210.0, 1331.0]),
        annual_income=np.array([0.0, 100.0, 110.0, 121.0]),
        cumulative_income=np.array([0.0, 100.0, 210.0, 331.0]),
        label="Test",
        color="#FF0000",
    )
    dto = simulation_result_to_dto(r)
    assert dto.label == "Test"
    assert dto.color == "#FF0000"
    assert dto.years == [0.0, 1.0, 2.0, 3.0]
    assert dto.patrimony == [1000.0, 1100.0, 1210.0, 1331.0]


def test_fixed_income_dto_includes_position_metadata():
    macro = MacroParams(selic=0.1475, ipca=0.048, cdi=0.1465, usd_brl=5.30,
                        is_stale=False, source_label="test")
    pos = FixedIncomePosition(
        name="LCI X", initial_amount=1000, purchase_date=date(2025, 1, 1),
        indexer="cdi", rate=0.95, is_tax_exempt=True, color="#00B894",
    )
    portfolio = simulate_fixed_income([pos], macro, horizon_years=2,
                                      start_date=date(2025, 1, 1))
    dto = fixed_income_portfolio_to_dto(portfolio)
    assert len(dto.projections) == 1
    assert dto.projections[0].name == "LCI X"
    assert dto.projections[0].color == "#00B894"
    assert dto.projections[0].indexer == "cdi"
    assert dto.total_initial == 1000.0
    assert len(dto.total_gross) == 3  # horizon + 1
