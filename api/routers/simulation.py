"""POST /api/simulate — deterministic simulation across all scenarios."""
from fastapi import APIRouter

from converters import monte_carlo_result_to_dto, simulation_result_to_dto
from core.config import (
    AssetClass,
    BenchmarkParams,
    MonteCarloParams,
    PortfolioParams,
)
from core.models import (
    annual_tax_comparison,
    sensitivity_portfolio,
    simulate_benchmark,
    simulate_portfolio,
    simulate_portfolio_mc,
    solve_goal_contribution,
)
from core.services.macro import get_macro_params
from schemas.inputs import BenchmarkInput, GoalSolveInput, SimulateInput, SimulateMonteCarloInput
from schemas.outputs import (
    GoalSolveOut,
    SensitivityRowOut,
    SimulateMonteCarloOut,
    SimulateOut,
    TaxComparisonRowOut,
)

router = APIRouter()


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


def _benchmark_label(input_bench: BenchmarkInput) -> str:
    if input_bench.kind == "cdi":
        return "CDI (líquido)"
    if input_bench.kind == "selic":
        return "Selic (líquido)"
    spread_pct = f"{input_bench.ipca_spread * 100:.1f}".replace(".", ",")
    return f"IPCA + {spread_pct}% (líquido)"


def _to_benchmark_params(
    input_bench: BenchmarkInput, capital: float, pf_params: PortfolioParams,
) -> BenchmarkParams:
    return BenchmarkParams(
        capital=capital,
        annual_rate=input_bench.annual_rate,
        tax_rate=input_bench.tax_rate,
        monthly_contribution=pf_params.monthly_contribution,
        contribution_inflation_indexed=pf_params.contribution_inflation_indexed,
        label=_benchmark_label(input_bench),
    )


@router.post("/api/simulate", response_model=SimulateOut)
def simulate(payload: SimulateInput) -> SimulateOut:
    """Run deterministic simulations (Portfolio + Benchmark) + sensitivity + tax comparison."""
    pf_params = _to_portfolio_params(payload.portfolio)
    bench_params = _to_benchmark_params(payload.benchmark, payload.capital, pf_params)
    macro = get_macro_params()

    pf_result = simulate_portfolio(
        pf_params,
        horizon_years=payload.horizon,
        reinvest_income=payload.reinvest,
        ipca=macro.ipca,
    )
    bench_result = simulate_benchmark(
        bench_params, horizon_years=payload.horizon, ipca=macro.ipca,
    )

    sens_rows = sensitivity_portfolio(pf_params, payload.horizon, ipca=macro.ipca)
    sensitivity = [
        SensitivityRowOut(
            parameter=row["Parâmetro"],
            pessimistic=float(row["Cenário Pessimista"]),
            optimistic=float(row["Cenário Otimista"]),
        )
        for row in sens_rows.to_dict("records")
    ]

    tax_rows = annual_tax_comparison(pf_params, bench_params)
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
        portfolio=simulation_result_to_dto(pf_result),
        benchmark=simulation_result_to_dto(bench_result),
        sensitivity=sensitivity,
        tax_comparison=tax_comparison,
    )


def _to_mc_params(input_mc) -> MonteCarloParams:
    return MonteCarloParams(
        n_trajectories=input_mc.n_trajectories,
        seed=input_mc.seed,
        target_patrimony=input_mc.target_patrimony,
    )


@router.post("/api/simulate/monte-carlo", response_model=SimulateMonteCarloOut)
def simulate_monte_carlo(payload: SimulateMonteCarloInput) -> SimulateMonteCarloOut:
    """Run Monte Carlo for the Portfolio scenario."""
    pf_params = _to_portfolio_params(payload.portfolio)
    mc_params = _to_mc_params(payload.mc)
    macro = get_macro_params()

    pf_mc = simulate_portfolio_mc(
        pf_params,
        horizon_years=payload.horizon,
        mc_params=mc_params,
        ipca=macro.ipca,
    )

    return SimulateMonteCarloOut(
        portfolio=monte_carlo_result_to_dto(pf_mc),
    )


@router.post("/api/goal/solve", response_model=GoalSolveOut)
def goal_solve(payload: GoalSolveInput) -> GoalSolveOut:
    """Binary-search the monthly contribution for P(final >= goal) >= confidence."""
    pf_params = _to_portfolio_params(payload.portfolio)
    macro = get_macro_params()
    result = solve_goal_contribution(
        pf_params,
        horizon_years=payload.horizon,
        goal_target=payload.goal_target,
        confidence=payload.confidence,
        ipca=macro.ipca,
        n_trajectories=payload.n_trajectories,
    )
    return GoalSolveOut(**result)
