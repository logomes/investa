"""Pydantic input schemas — the public API contract from the frontend.

Naming convention: API uses camelCase (matching the TypeScript frontend);
internally fields use snake_case via `Field(alias=...)`. Validation rules
mirror the spec's "Validações" tables.
"""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _camel(s: str) -> str:
    """Convert snake_case to camelCase for API field aliases."""
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class _CamelModel(BaseModel):
    """Base model: accept and emit camelCase, populate by name allowed."""
    model_config = ConfigDict(
        alias_generator=_camel,
        populate_by_name=True,
    )


class PortfolioAssetInput(_CamelModel):
    name: str = Field(min_length=1)
    weight: float = Field(ge=0, le=1.0)
    expected_yield: float = Field(ge=-1.0, le=1.0)
    capital_gain: float = Field(default=0.0)
    tax_rate: float = Field(default=0.0, ge=0, le=1.0)
    note: str = ""
    volatility: float = Field(default=0.15, ge=0, le=1.0)


class PortfolioInput(_CamelModel):
    capital: float = Field(gt=0)
    monthly_contribution: float = Field(default=0.0, ge=0)
    contribution_inflation_indexed: bool = True
    assets: list[PortfolioAssetInput]


class BenchmarkInput(_CamelModel):
    kind: Literal["cdi", "selic", "ipca_plus"] = "cdi"
    annual_rate: float = Field(ge=0, le=1.0)
    ipca_spread: float = Field(default=0.0, ge=0, le=0.5)
    tax_rate: float = Field(default=0.175, ge=0, le=1.0)


class MonteCarloInput(_CamelModel):
    n_trajectories: int = Field(default=10_000, ge=100, le=50_000)
    seed: int | None = None
    target_patrimony: float = Field(default=0.0, ge=0)


class SimulateInput(_CamelModel):
    capital: float = Field(gt=0)
    horizon: int = Field(ge=1, le=30)
    reinvest: bool = True
    portfolio: PortfolioInput
    benchmark: BenchmarkInput


class SimulateMonteCarloInput(_CamelModel):
    horizon: int = Field(ge=1, le=30)
    portfolio: PortfolioInput
    mc: MonteCarloInput


class FixedIncomePositionInput(_CamelModel):
    name: str = Field(min_length=1)
    initial_amount: float = Field(gt=0)
    purchase_date: date
    indexer: Literal["prefixado", "cdi", "selic", "ipca"]
    rate: float
    maturity_date: date | None = None
    is_tax_exempt: bool = False

    @field_validator("maturity_date")
    @classmethod
    def maturity_after_purchase(cls, v: date | None, info) -> date | None:
        if v is None:
            return v
        purchase = info.data.get("purchase_date")
        if purchase is not None and v <= purchase:
            raise ValueError("maturity_date must be after purchase_date")
        return v


class FixedIncomeSimulateInput(_CamelModel):
    positions: list[FixedIncomePositionInput]
    horizon_years: int = Field(ge=1, le=50)
    start_date: date | None = None
