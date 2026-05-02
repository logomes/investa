"""POST /api/fixed-income/simulate — RF projection given user positions."""
from datetime import date

from fastapi import APIRouter

from converters import fixed_income_portfolio_to_dto
from core.config import FixedIncomePosition
from core.models import simulate_fixed_income
from core.services.macro import get_macro_params
from schemas.inputs import FixedIncomeSimulateInput
from schemas.outputs import FixedIncomePortfolioOut

router = APIRouter()

_PALETTE = [
    "#3498DB", "#E67E22", "#9B59B6", "#1ABC9C",
    "#E74C3C", "#16A085", "#F39C12", "#34495E",
]


@router.post("/api/fixed-income/simulate", response_model=FixedIncomePortfolioOut)
def fixed_income_simulate(payload: FixedIncomeSimulateInput) -> FixedIncomePortfolioOut:
    """Project each position year-by-year applying regressive IR."""
    macro = get_macro_params()
    positions = [
        FixedIncomePosition(
            name=p.name,
            initial_amount=p.initial_amount,
            purchase_date=p.purchase_date,
            indexer=p.indexer,
            rate=p.rate,
            maturity_date=p.maturity_date,
            is_tax_exempt=p.is_tax_exempt,
            color=_PALETTE[i % len(_PALETTE)],
        )
        for i, p in enumerate(payload.positions)
    ]
    portfolio = simulate_fixed_income(
        positions=positions,
        macro=macro,
        horizon_years=payload.horizon_years,
        start_date=payload.start_date,
    )
    return fixed_income_portfolio_to_dto(portfolio)
