"""Pydantic output schemas — what the API returns. camelCase aliases.

numpy arrays in core/models.py results are converted to list[float] via
api/converters.py before being passed to these models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


def _camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)


class MacroOut(_CamelModel):
    selic: float
    cdi: float
    ipca: float
    usd_brl: float
    is_stale: bool
    source_label: str


class SimulationResultOut(_CamelModel):
    """Yearly arrays for a single scenario (Portfolio / Benchmark)."""
    label: str
    color: str
    years: list[float]
    patrimony: list[float]
    annual_income: list[float]
    cumulative_income: list[float]
    gross_patrimony: list[float]
    tax_paid_cumulative: list[float]
    exit_tax: list[float]


class SensitivityRowOut(_CamelModel):
    parameter: str
    pessimistic: float
    optimistic: float


class TaxProjectionRowOut(_CamelModel):
    name: str
    tax_profile: str
    tax_paid_path: float
    exit_tax: float
    net_final: float
    gross_final: float


class TaxProjectionOut(_CamelModel):
    rows: list[TaxProjectionRowOut]
    tax_paid_by_year: list[float]
    exit_tax_by_year: list[float]
    all_taxed_final: float       # net final if EVERY class were rf_regressiva ("o que suas isenções valem")


class SimulateOut(_CamelModel):
    """Full deterministic-simulation output."""
    portfolio: SimulationResultOut
    benchmark: SimulationResultOut
    sensitivity: list[SensitivityRowOut]
    tax_projection: TaxProjectionOut


class MonteCarloResultOut(_CamelModel):
    label: str
    color: str
    p10: list[float]
    p50: list[float]
    p90: list[float]
    final_distribution: list[float]
    max_drawdowns: list[float]


class SimulateMonteCarloOut(_CamelModel):
    portfolio: MonteCarloResultOut


class GoalSolveOut(_CamelModel):
    required_monthly_contribution: float
    achieved_probability: float
    attainable: bool
    iterations: int


class FixedIncomeProjectionOut(_CamelModel):
    name: str
    color: str
    indexer: Literal["prefixado", "cdi", "selic", "ipca"]
    years: list[int]
    gross_values: list[float]
    net_values: list[float]
    matured: list[bool]


class FixedIncomePortfolioOut(_CamelModel):
    projections: list[FixedIncomeProjectionOut]
    total_gross: list[float]
    total_net: list[float]
    total_initial: float


class PortfolioDefaultsOut(_CamelModel):
    portfolio: dict
    benchmark: dict


class HealthOut(_CamelModel):
    status: str
    version: str


class QuoteOut(_CamelModel):
    ticker: str
    market: Literal["BR", "US"]
    price: float
    currency: str
    as_of: datetime
    source: str


class ApiError(_CamelModel):
    error: str
    message: str
    details: dict | None = None
