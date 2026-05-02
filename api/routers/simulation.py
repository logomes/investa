"""POST /api/simulate — deterministic simulation across all scenarios."""
from fastapi import APIRouter

from converters import simulation_result_to_dto
from core.config import (
    AssetClass,
    BenchmarkParams,
    FinancingParams,
    PortfolioParams,
    RealEstateParams,
)
from core.models import (
    annual_tax_comparison,
    sensitivity_real_estate,
    simulate_benchmark,
    simulate_portfolio,
    simulate_real_estate,
)
from core.services.macro import get_macro_params
from schemas.inputs import SimulateInput
from schemas.outputs import SensitivityRowOut, SimulateOut, TaxComparisonRowOut

router = APIRouter()


def _to_real_estate_params(input_re) -> RealEstateParams:
    """Map RealEstateInput Pydantic model to RealEstateParams dataclass."""
    financing = None
    if input_re.financing is not None:
        f = input_re.financing
        financing = FinancingParams(
            term_years=f.term_years,
            annual_rate=f.annual_rate,
            entry_pct=f.entry_pct,
            system=f.system,
            monthly_insurance_rate=f.monthly_insurance_rate,
        )
    return RealEstateParams(
        property_value=input_re.property_value,
        monthly_rent=input_re.monthly_rent,
        annual_appreciation=input_re.annual_appreciation,
        iptu_rate=input_re.iptu_rate,
        vacancy_months_per_year=input_re.vacancy_months_per_year,
        management_fee_pct=input_re.management_fee_pct,
        maintenance_annual=input_re.maintenance_annual,
        insurance_annual=input_re.insurance_annual,
        income_tax_bracket=input_re.income_tax_bracket,
        acquisition_cost_pct=input_re.acquisition_cost_pct,
        appreciation_volatility=input_re.appreciation_volatility,
        financing=financing,
    )


def _to_portfolio_params(input_pf) -> PortfolioParams:
    return PortfolioParams(
        capital=input_pf.capital,
        monthly_contribution=input_pf.monthly_contribution,
        contribution_inflation_indexed=input_pf.contribution_inflation_indexed,
        assets=[
            AssetClass(
                name=a.name, weight=a.weight, expected_yield=a.expected_yield,
                capital_gain=a.capital_gain, tax_rate=a.tax_rate, note=a.note,
                volatility=a.volatility,
            )
            for a in input_pf.assets
        ],
    )


def _to_benchmark_params(input_bench, capital: float) -> BenchmarkParams:
    return BenchmarkParams(
        selic_rate=input_bench.selic_rate,
        tax_rate=input_bench.tax_rate,
        capital=capital,
    )


def _build_sensitivity_deltas(re_params: RealEstateParams) -> dict:
    """Standard ±% sensitivity ranges used by the dashboard."""
    return {
        "monthly_rent": (re_params.monthly_rent * 0.8, re_params.monthly_rent * 1.2),
        "annual_appreciation": (
            re_params.annual_appreciation - 0.03,
            re_params.annual_appreciation + 0.03,
        ),
        "vacancy_months_per_year": (0.0, 3.0),
        "management_fee_pct": (0.0, 0.15),
        "iptu_rate": (0.005, 0.020),
        "income_tax_bracket": (0.0, 0.275),
    }


@router.post("/api/simulate", response_model=SimulateOut)
def simulate(payload: SimulateInput) -> SimulateOut:
    """Run all three deterministic simulations + sensitivity + tax comparison."""
    re_params = _to_real_estate_params(payload.real_estate)
    pf_params = _to_portfolio_params(payload.portfolio)
    bench_params = _to_benchmark_params(payload.benchmark, payload.capital)
    macro = get_macro_params()

    re_result = simulate_real_estate(
        re_params,
        horizon_years=payload.horizon,
        reinvest_income=payload.reinvest,
        capital_initial=payload.capital,
    )
    pf_result = simulate_portfolio(
        pf_params,
        horizon_years=payload.horizon,
        reinvest_income=payload.reinvest,
        ipca=macro.ipca,
    )
    bench_result = simulate_benchmark(bench_params, horizon_years=payload.horizon)

    deltas = _build_sensitivity_deltas(re_params)
    sens_rows = sensitivity_real_estate(re_params, payload.horizon, deltas)
    sensitivity = [
        SensitivityRowOut(
            parameter=row["Parâmetro"],
            pessimistic=float(row["Cenário Pessimista"]),
            optimistic=float(row["Cenário Otimista"]),
        )
        for row in sens_rows.to_dict("records")
    ]

    tax_rows = annual_tax_comparison(re_params, pf_params)
    tax_comparison = [
        TaxComparisonRowOut(
            scenario=row["Cenário"],
            gross_income=float(row["Receita Bruta"]),
            annual_tax=float(row["Imposto Anual"]),
            net_income=float(row["Receita Líquida"]),
            effective_tax_burden=float(row["Carga Tributária Efetiva"]),
        )
        for row in tax_rows.to_dict("records")
    ]

    return SimulateOut(
        real_estate=simulation_result_to_dto(re_result),
        portfolio=simulation_result_to_dto(pf_result),
        benchmark=simulation_result_to_dto(bench_result),
        sensitivity=sensitivity,
        tax_comparison=tax_comparison,
    )
