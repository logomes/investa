"""Convert core dataclasses (with numpy arrays) to Pydantic DTOs.

Centralizes the ndarray → list[float] coercion so endpoints stay clean.
"""
from __future__ import annotations

import numpy as np

from core.models import (
    FixedIncomePortfolio,
    FixedIncomeProjection,
    MonteCarloResult,
    SimulationResult,
)
from schemas.outputs import (
    FixedIncomePortfolioOut,
    FixedIncomeProjectionOut,
    MonteCarloResultOut,
    SimulationResultOut,
)


def _to_list(arr: np.ndarray | None) -> list[float] | None:
    """Convert ndarray to a JSON-friendly list of floats. None passes through."""
    if arr is None:
        return None
    return [float(x) for x in arr]


def simulation_result_to_dto(r: SimulationResult) -> SimulationResultOut:
    return SimulationResultOut(
        label=r.label,
        color=r.color,
        years=_to_list(r.years),
        patrimony=_to_list(r.patrimony),
        annual_income=_to_list(r.annual_income),
        cumulative_income=_to_list(r.cumulative_income),
        gross_patrimony=_to_list(r.gross_patrimony),
        tax_paid_cumulative=_to_list(r.tax_paid_cumulative),
        exit_tax=_to_list(r.exit_tax),
    )


def monte_carlo_result_to_dto(r: MonteCarloResult) -> MonteCarloResultOut:
    return MonteCarloResultOut(
        label=r.label,
        color=r.color,
        p10=_to_list(r.percentiles["p10"]),
        p50=_to_list(r.percentiles["p50"]),
        p90=_to_list(r.percentiles["p90"]),
        final_distribution=_to_list(r.final_distribution),
        max_drawdowns=_to_list(r.max_drawdowns),
    )


def fixed_income_projection_to_dto(p: FixedIncomeProjection) -> FixedIncomeProjectionOut:
    return FixedIncomeProjectionOut(
        name=p.position.name,
        color=p.position.color,
        indexer=p.position.indexer,
        years=[int(x) for x in p.years],
        gross_values=_to_list(p.gross_values),
        net_values=_to_list(p.net_values),
        matured=[bool(x) for x in p.matured],
    )


def fixed_income_portfolio_to_dto(p: FixedIncomePortfolio) -> FixedIncomePortfolioOut:
    return FixedIncomePortfolioOut(
        projections=[fixed_income_projection_to_dto(proj) for proj in p.projections],
        total_gross=_to_list(p.total_gross),
        total_net=_to_list(p.total_net),
        total_initial=p.total_initial,
    )
