"""Financial simulation engine: diversified portfolio, passive benchmark (CDI/Selic/IPCA+x), Monte Carlo, sensitivity and tax comparison."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from typing import Iterable

import numpy as np
import pandas as pd

from .config import (
    BenchmarkParams,
    FixedIncomePosition,
    MacroParams,
    MonteCarloParams,
    PortfolioParams,
)


@dataclass(slots=True)
class SimulationResult:
    years: np.ndarray
    patrimony: np.ndarray            # Patrimony at end of each year
    annual_income: np.ndarray        # Income generated in that year
    cumulative_income: np.ndarray    # Total income accumulated
    label: str
    color: str


@dataclass(slots=True, frozen=True)
class MonteCarloResult:
    """Outcome of a Monte Carlo simulation: trajectories + summary stats."""
    trajectories: np.ndarray         # shape (N, horizon+1) — patrimônio ano a ano
    percentiles: dict                # {"p10","p50","p90"} — cada um shape (horizon+1,)
    final_distribution: np.ndarray   # shape (N,) — patrimônio no ano final
    max_drawdowns: np.ndarray        # shape (N,) — peak-to-trough drop por trajetória
    label: str
    color: str

    def prob_target(self, target: float) -> float:
        """Fração de trajetórias onde patrimônio final >= target."""
        return float((self.final_distribution >= target).mean())


@dataclass(slots=True, frozen=True)
class FixedIncomeProjection:
    """Year-by-year projection for a single fixed-income position."""
    position: FixedIncomePosition
    years: np.ndarray              # 0, 1, ..., horizon
    gross_values: np.ndarray       # nominal value at end of each year
    net_values: np.ndarray         # value after IR (== gross if isento)
    matured: np.ndarray            # bool — True from the maturity year onward


@dataclass(slots=True, frozen=True)
class FixedIncomePortfolio:
    """Aggregate of all fixed-income projections plus per-year totals."""
    projections: list[FixedIncomeProjection]
    total_gross: np.ndarray
    total_net: np.ndarray
    total_initial: float


def simulate_fixed_income(
    positions: list[FixedIncomePosition],
    macro: MacroParams,
    horizon_years: int,
    start_date: date | None = None,
) -> FixedIncomePortfolio:
    """Project each position year-by-year, applying regressive IR and maturity.

    Year 0 corresponds to start_date. Position values at year 0 already reflect
    accumulated growth from purchase_date to start_date. Macro values are held
    constant for the entire horizon.
    """
    if start_date is None:
        start_date = date.today()
    n_points = horizon_years + 1
    years = np.arange(n_points)

    projections: list[FixedIncomeProjection] = []
    total_gross = np.zeros(n_points)
    total_net = np.zeros(n_points)
    total_initial = 0.0

    for pos in positions:
        r = pos.effective_annual_rate(macro)
        gross = np.zeros(n_points)
        net = np.zeros(n_points)
        matured = np.zeros(n_points, dtype=bool)

        # Pre-compute frozen value at maturity if applicable.
        # applicable_ir_rate returns 0 when isento, so the same formula works for both.
        frozen_gross = None
        frozen_net = None
        if pos.maturity_date is not None:
            mat_holding = max(0, (pos.maturity_date - pos.purchase_date).days)
            frozen_gross = pos.initial_amount * (1 + r) ** (mat_holding / 365)
            ir_at_mat = pos.applicable_ir_rate(pos.maturity_date)
            frozen_net = pos.initial_amount + (frozen_gross - pos.initial_amount) * (1 - ir_at_mat)

        for t in range(n_points):
            current_date = _add_years(start_date, t)
            if pos.maturity_date is not None and current_date >= pos.maturity_date:
                gross[t] = frozen_gross
                net[t] = frozen_net
                matured[t] = True
            else:
                holding = pos.holding_days(current_date)
                gross[t] = pos.initial_amount * (1 + r) ** (holding / 365)
                ir = pos.applicable_ir_rate(current_date)
                net[t] = pos.initial_amount + (gross[t] - pos.initial_amount) * (1 - ir)

        projections.append(FixedIncomeProjection(
            position=pos,
            years=years.copy(),
            gross_values=gross,
            net_values=net,
            matured=matured,
        ))
        total_gross += gross
        total_net += net
        total_initial += pos.initial_amount

    return FixedIncomePortfolio(
        projections=projections,
        total_gross=total_gross,
        total_net=total_net,
        total_initial=total_initial,
    )


def _add_years(d: date, years: int) -> date:
    """Return d + N years, falling back to Feb 28 if Feb 29 is invalid in target year."""
    try:
        return d.replace(year=d.year + years)
    except ValueError:  # Feb 29 in non-leap target year
        return d.replace(year=d.year + years, day=28)


def _draw_normal_returns(
    rng: np.random.Generator,
    mean: float,
    sigma: float,
    shape: tuple,
) -> np.ndarray:
    """Generate normal random returns with given shape, mean, and sigma."""
    return rng.normal(loc=mean, scale=sigma, size=shape)


def _compute_percentiles(trajectories: np.ndarray) -> dict:
    """Compute p10/p50/p90 across trajectories (axis=0) for each year."""
    return {
        "p10": np.percentile(trajectories, 10, axis=0),
        "p50": np.percentile(trajectories, 50, axis=0),
        "p90": np.percentile(trajectories, 90, axis=0),
    }


def _compute_max_drawdowns(trajectories: np.ndarray) -> np.ndarray:
    """Peak-to-trough relative drop per trajectory.

    Returns positive fractions in [0, 1]. A trajectory that only grows has drawdown 0.
    """
    running_max = np.maximum.accumulate(trajectories, axis=1)
    # Avoid divide-by-zero: where running_max == 0, drawdown is 0
    safe_max = np.where(running_max == 0, 1.0, running_max)
    drawdowns = (running_max - trajectories) / safe_max
    return drawdowns.max(axis=1)


def simulate_portfolio(
    params: PortfolioParams,
    horizon_years: int,
    reinvest_income: bool = True,
    ipca: float = 0.0,
) -> SimulationResult:
    """Simulate a diversified portfolio with full reinvestment and optional aporte.

    `ipca` is only used when `params.contribution_inflation_indexed` is True.
    Contributions enter at the beginning of each year (PMT begin) and compound
    at the same rate as `reinvest_income` mode.
    """
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    years = np.arange(0, horizon_years + 1)
    rate = params.total_return() if reinvest_income else params.blended_capital_gain()
    yield_only = params.blended_yield()

    # Vectorized base patrimony (no contributions)
    patrimony = params.capital * (1 + rate) ** years

    # Add contributions (begin-of-year), compounded at `rate` until end-of-year y
    monthly = params.monthly_contribution
    indexed = params.contribution_inflation_indexed
    if monthly > 0:
        annual_base = 12.0 * monthly
        contribution_pv = np.zeros_like(patrimony, dtype=float)
        for y in range(1, horizon_years + 1):
            total = 0.0
            for t in range(y):
                aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0)
                total += aporte_t * (1 + rate) ** (y - t)
            contribution_pv[y] = total
        patrimony = patrimony + contribution_pv

    # Annual income generated (yield on patrimony at start of year)
    if reinvest_income:
        annual_income = np.array([
            patrimony[max(y - 1, 0)] * yield_only
            for y in years
        ])
    else:
        # Without reinvest, income is on principal + accumulated contributions
        annual_income = patrimony * yield_only

    cumulative_income = np.cumsum(annual_income)

    return SimulationResult(
        years=years,
        patrimony=patrimony,
        annual_income=annual_income,
        cumulative_income=cumulative_income,
        label="Carteira Diversificada",
        color="#27AE60",
    )


def simulate_portfolio_mc(
    params: PortfolioParams,
    horizon_years: int,
    mc_params: MonteCarloParams,
    ipca: float = 0.0,
) -> MonteCarloResult:
    """Monte Carlo simulation of the diversified portfolio.

    Each year, each asset's net return is drawn from N(mean, volatility^2)
    independently. Portfolio return = weighted sum across assets. Aporte
    mensal is deterministic (PMT-begin: added at the start of the year,
    compounded with that year's return).
    """
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    rng = np.random.default_rng(mc_params.seed)
    N, T = mc_params.n_trajectories, horizon_years
    K = len(params.assets)

    weights = np.array([a.weight for a in params.assets])
    means = np.array([
        a.expected_yield * (1 - a.tax_rate) + a.capital_gain
        for a in params.assets
    ])
    sigmas = np.array([a.volatility for a in params.assets])

    # Per-trajectory per-year per-asset draws: shape (N, T, K)
    draws = _draw_normal_returns(rng, mean=means, sigma=sigmas, shape=(N, T, K))
    # Portfolio return = weighted sum across assets: shape (N, T)
    portfolio_returns = (draws * weights).sum(axis=2)

    monthly = params.monthly_contribution
    indexed = params.contribution_inflation_indexed
    annual_base = 12.0 * monthly

    trajectories = np.zeros((N, T + 1))
    trajectories[:, 0] = params.capital
    for t in range(T):
        if monthly > 0:
            aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0)
        else:
            aporte_t = 0.0
        # PMT-begin: add aporte first, then compound with year's return
        trajectories[:, t + 1] = (trajectories[:, t] + aporte_t) * (1 + portfolio_returns[:, t])

    return MonteCarloResult(
        trajectories=trajectories,
        percentiles=_compute_percentiles(trajectories),
        final_distribution=trajectories[:, -1].copy(),
        max_drawdowns=_compute_max_drawdowns(trajectories),
        label="Carteira (MC)",
        color="#27AE60",
    )


def sensitivity_portfolio(
    base_params: PortfolioParams,
    horizon_years: int,
    ipca: float = 0.0,
) -> pd.DataFrame:
    """Tornado-style sensitivity for the portfolio: vary one dimension at a time.

    Deltas are applied uniformly to every asset (tax clamped to [0, 1]) so the
    rows read as carteira-level scenarios, not per-asset ones.
    """
    def final_patrimony(params: PortfolioParams) -> float:
        result = simulate_portfolio(
            params, horizon_years, reinvest_income=True, ipca=ipca,
        )
        return float(result.patrimony[-1])

    def variant(
        *,
        yield_delta: float = 0.0,
        gain_delta: float = 0.0,
        contribution_mult: float = 1.0,
        tax_delta: float = 0.0,
    ) -> PortfolioParams:
        assets = [
            replace(
                a,
                expected_yield=a.expected_yield + yield_delta,
                capital_gain=a.capital_gain + gain_delta,
                tax_rate=min(max(a.tax_rate + tax_delta, 0.0), 1.0),
            )
            for a in base_params.assets
        ]
        return replace(
            base_params,
            assets=assets,
            monthly_contribution=base_params.monthly_contribution * contribution_mult,
        )

    variations = [
        ("Yield da carteira (±1,5pp)",
         variant(yield_delta=-0.015), variant(yield_delta=0.015)),
        ("Ganho de capital (±1,5pp)",
         variant(gain_delta=-0.015), variant(gain_delta=0.015)),
        ("Aporte mensal (±25%)",
         variant(contribution_mult=0.75), variant(contribution_mult=1.25)),
        ("IR efetivo (±5pp)",
         variant(tax_delta=0.05), variant(tax_delta=-0.05)),
    ]

    return pd.DataFrame([
        {
            "Parâmetro": label,
            "Cenário Pessimista": final_patrimony(pessimistic),
            "Cenário Otimista": final_patrimony(optimistic),
        }
        for label, pessimistic, optimistic in variations
    ])


def solve_goal_contribution(
    portfolio: PortfolioParams,
    horizon_years: int,
    goal_target: float,
    confidence: float,
    ipca: float = 0.0,
    n_trajectories: int = 1500,
    upper_bound: float = 50_000.0,
    tolerance: float = 50.0,
) -> dict:
    """Smallest monthly contribution with P(final patrimony >= goal) >= confidence.

    Binary search over `simulate_portfolio_mc` with a fixed seed, so the
    probability is monotone in the contribution and the result reproducible.
    """
    mc = MonteCarloParams(n_trajectories=n_trajectories, seed=42)

    def probability(monthly: float) -> float:
        params = replace(portfolio, monthly_contribution=monthly)
        result = simulate_portfolio_mc(params, horizon_years, mc, ipca=ipca)
        return result.prob_target(goal_target)

    iterations = 0

    p_zero = probability(0.0)
    if p_zero >= confidence:
        return {
            "required_monthly_contribution": 0.0,
            "achieved_probability": p_zero,
            "attainable": True,
            "iterations": iterations,
        }

    p_hi = probability(upper_bound)
    if p_hi < confidence:
        return {
            "required_monthly_contribution": upper_bound,
            "achieved_probability": p_hi,
            "attainable": False,
            "iterations": iterations,
        }

    lo, hi = 0.0, upper_bound
    while hi - lo > tolerance and iterations < 12:
        mid = (lo + hi) / 2
        iterations += 1
        p_mid = probability(mid)
        if p_mid >= confidence:
            hi, p_hi = mid, p_mid
        else:
            lo = mid

    return {
        "required_monthly_contribution": hi,
        "achieved_probability": p_hi,
        "attainable": True,
        "iterations": iterations,
    }


def simulate_benchmark(
    params: BenchmarkParams,
    horizon_years: int,
    ipca: float = 0.0,
) -> SimulationResult:
    """Passive benchmark (CDI / Selic / IPCA+x) with reinvestment and aportes.

    Receives the same begin-of-year contribution flow as `simulate_portfolio`,
    so "carteira vs benchmark" compares identical cash flows.
    """
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    years = np.arange(0, horizon_years + 1)
    rate = params.net_yield()
    patrimony = params.capital * (1 + rate) ** years

    annual_base = 12.0 * params.monthly_contribution
    if annual_base > 0:
        indexed = params.contribution_inflation_indexed
        contribution_pv = np.zeros_like(patrimony, dtype=float)
        for y in range(1, horizon_years + 1):
            total = 0.0
            for t in range(y):
                aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0)
                total += aporte_t * (1 + rate) ** (y - t)
            contribution_pv[y] = total
        patrimony = patrimony + contribution_pv

    annual_income = np.array([
        patrimony[max(y - 1, 0)] * rate
        for y in years
    ])
    cumulative_income = np.cumsum(annual_income)

    return SimulationResult(
        years=years,
        patrimony=patrimony,
        annual_income=annual_income,
        cumulative_income=cumulative_income,
        label=params.label,
        color="#F39C12",
    )


def build_comparison_dataframe(
    results: Iterable[SimulationResult],
) -> pd.DataFrame:
    """Combine multiple simulation results into a single long-format dataframe."""
    frames = []
    for r in results:
        frames.append(pd.DataFrame({
            "Ano": r.years,
            "Patrimônio": r.patrimony,
            "Renda Anual": r.annual_income,
            "Renda Acumulada": r.cumulative_income,
            "Cenário": r.label,
        }))
    return pd.concat(frames, ignore_index=True)


# ---------- Tax impact analysis ----------

def annual_tax_comparison(
    portfolio: PortfolioParams,
    benchmark: BenchmarkParams,
) -> pd.DataFrame:
    """Compare annual tax burden: carteira vs passive benchmark."""
    pf_gross_income = sum(
        portfolio.capital * a.weight * a.expected_yield
        for a in portfolio.assets
    )
    pf_tax = sum(
        portfolio.capital * a.weight * a.expected_yield * a.tax_rate
        for a in portfolio.assets
    )

    bench_gross_income = benchmark.capital * benchmark.annual_rate
    bench_tax = bench_gross_income * benchmark.tax_rate

    return pd.DataFrame([
        {
            "Cenário": "Carteira Diversificada",
            "Receita Bruta": pf_gross_income,
            "Imposto Anual": pf_tax,
            "Receita Líquida": pf_gross_income - pf_tax,
            "Carga Tributária Efetiva": pf_tax / pf_gross_income if pf_gross_income else 0.0,
        },
        {
            "Cenário": benchmark.label,
            "Receita Bruta": bench_gross_income,
            "Imposto Anual": bench_tax,
            "Receita Líquida": bench_gross_income - bench_tax,
            "Carga Tributária Efetiva": benchmark.tax_rate if bench_gross_income else 0.0,
        },
    ])
