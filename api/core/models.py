"""Financial simulation engine: diversified portfolio, passive benchmark (CDI/Selic/IPCA+x), Monte Carlo, sensitivity and tax comparison."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from typing import Iterable

import numpy as np
import pandas as pd

from .config import (
    COME_COTAS_RATE,
    EXIT_GAIN_RATE,
    WHT_DIVIDENDOS_EXTERIOR,
    AssetClass,
    BenchmarkParams,
    FixedIncomePosition,
    MacroParams,
    MonteCarloParams,
    PortfolioParams,
    regressive_rate,
)


@dataclass(slots=True)
class SimulationResult:
    years: np.ndarray
    patrimony: np.ndarray            # Patrimony at end of each year (net of redemption)
    annual_income: np.ndarray        # Income generated in that year
    cumulative_income: np.ndarray    # Total income accumulated
    label: str
    color: str
    gross_patrimony: np.ndarray      # market value (latent exit tax inside)
    tax_paid_cumulative: np.ndarray  # path taxes paid (WHT + come-cotas + anual)
    exit_tax: np.ndarray             # tax due if fully redeemed at end of year y


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


@dataclass(slots=True, frozen=True)
class ClassTaxSummary:
    name: str
    profile: str
    tax_paid: float
    exit_tax: float
    net: float
    gross: float


@dataclass(slots=True)
class TaxedSimOutput:
    """Arrays shaped (N, horizon+1); N=1 for the deterministic path."""
    net: np.ndarray
    gross: np.ndarray
    tax_paid_cumulative: np.ndarray
    exit_tax: np.ndarray
    income: np.ndarray                    # distributed yield (net of WHT/anual tax)
    per_class_final: list[ClassTaxSummary]  # mean over N


def _dist_tax_rate(a: AssetClass) -> float:
    """Annual tax rate applied to a class's DISTRIBUTED yield."""
    if a.tax_profile == "dividendos_exterior":
        return WHT_DIVIDENDOS_EXTERIOR
    if a.tax_profile == "tributado_anual":
        return a.tax_rate
    return 0.0


def _simulate_taxed_classes(
    params: PortfolioParams,
    horizon_years: int,
    returns: np.ndarray,        # gross TOTAL return draws, shape (N, T, K)
    ipca: float,
    reinvest_income: bool,
) -> TaxedSimOutput:
    """Per-class, tax-aware accumulation (buy-and-hold; no rebalancing).

    Conventions: contributions enter begin-of-year split by weight (PMT-begin);
    each class's drawn return splits into a deterministic yield share
    (expected_yield) and the remainder as accrued gain; distributed yields are
    reinvested into the same class (raising its cost basis) when
    reinvest_income is True. Come-cotas drags 15% of positive returns with no
    loss carryforward; exit tax assumes full redemption at each year-end.
    """
    N, T, K = returns.shape
    assets = params.assets
    annual_base = 12.0 * params.monthly_contribution
    indexed = params.contribution_inflation_indexed

    value = np.zeros((K, N))
    basis = np.zeros((K, N))
    growth = np.ones((K, N, T + 1))            # cumulative gross factors (rf tranches)
    tranches: list[list[tuple[int, float]]] = [[] for _ in range(K)]
    tax_paid = np.zeros((K, N))

    for k, a in enumerate(assets):
        p0 = params.capital * a.weight
        value[k] += p0
        basis[k] += p0
        if a.tax_profile == "rf_regressiva":
            tranches[k].append((0, p0))

    gross_out = np.zeros((N, T + 1))
    net_out = np.zeros((N, T + 1))
    tax_paid_out = np.zeros((N, T + 1))
    exit_out = np.zeros((N, T + 1))
    income_out = np.zeros((N, T + 1))

    gross_out[:, 0] = value.sum(axis=0)
    net_out[:, 0] = gross_out[:, 0]
    income_out[:, 0] = sum(
        params.capital * a.weight * a.expected_yield * (1 - _dist_tax_rate(a))
        for a in assets
    )

    def _class_exit(k: int, a: AssetClass, year: int) -> np.ndarray:
        if a.tax_profile in EXIT_GAIN_RATE:
            return EXIT_GAIN_RATE[a.tax_profile] * np.maximum(value[k] - basis[k], 0.0)
        if a.tax_profile == "rf_regressiva":
            total = np.zeros(N)
            for entry, p in tranches[k]:
                v_tr = p * growth[k, :, year] / growth[k, :, entry]
                total += regressive_rate(year - entry) * np.maximum(v_tr - p, 0.0)
            return total
        return np.zeros(N)

    for t in range(T):
        aporte_t = annual_base * ((1 + ipca) ** t if indexed else 1.0) if annual_base > 0 else 0.0
        for k, a in enumerate(assets):
            ap = aporte_t * a.weight
            if ap > 0:
                value[k] += ap
                basis[k] += ap
                if a.tax_profile == "rf_regressiva":
                    tranches[k].append((t, ap))

            r = returns[:, t, k]
            profile = a.tax_profile

            if profile == "rf_regressiva":
                value[k] *= (1 + r)
                growth[k, :, t + 1] = growth[k, :, t] * (1 + r)
                continue
            growth[k, :, t + 1] = growth[k, :, t]   # keep factors aligned for non-rf too

            if profile == "come_cotas":
                ret = value[k] * r
                drag = COME_COTAS_RATE * np.maximum(ret, 0.0)
                value[k] = value[k] + ret - drag
                tax_paid[k] += drag
                continue

            y_rate = a.expected_yield
            g = r - y_rate
            dist_gross = value[k] * y_rate
            rate = _dist_tax_rate(a)
            if rate > 0.0:
                charged = rate * dist_gross
                dist = dist_gross - charged
                tax_paid[k] += charged
            else:                                   # isento, fii, acoes_br
                dist = dist_gross
            value[k] *= (1 + g)
            income_out[:, t + 1] += dist
            if reinvest_income:
                value[k] += dist
                basis[k] += dist

        gross_out[:, t + 1] = value.sum(axis=0)
        tax_paid_out[:, t + 1] = tax_paid.sum(axis=0)
        exit_y = np.zeros(N)
        for k, a in enumerate(assets):
            exit_y += _class_exit(k, a, t + 1)
        exit_out[:, t + 1] = exit_y
        net_out[:, t + 1] = gross_out[:, t + 1] - exit_y

    per_class_final = []
    for k, a in enumerate(assets):
        cls_exit = float(np.mean(_class_exit(k, a, T)))
        cls_gross = float(np.mean(value[k]))
        per_class_final.append(ClassTaxSummary(
            name=a.name,
            profile=a.tax_profile,
            tax_paid=float(np.mean(tax_paid[k])),
            exit_tax=cls_exit,
            gross=cls_gross,
            net=cls_gross - cls_exit,
        ))

    return TaxedSimOutput(
        net=net_out, gross=gross_out, tax_paid_cumulative=tax_paid_out,
        exit_tax=exit_out, income=income_out, per_class_final=per_class_final,
    )


def simulate_portfolio(
    params: PortfolioParams,
    horizon_years: int,
    reinvest_income: bool = True,
    ipca: float = 0.0,
) -> SimulationResult:
    """Tax-aware portfolio simulation (deterministic = the σ=0, N=1 MC path)."""
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    gross_means = np.array([a.gross_return for a in params.assets])
    returns = np.tile(gross_means, (1, horizon_years, 1))

    out = _simulate_taxed_classes(params, horizon_years, returns, ipca, reinvest_income)

    years = np.arange(0, horizon_years + 1)
    annual_income = out.income[0]
    return SimulationResult(
        years=years,
        patrimony=out.net[0],
        annual_income=annual_income,
        cumulative_income=np.cumsum(annual_income),
        label="Carteira Diversificada",
        color="#27AE60",
        gross_patrimony=out.gross[0],
        tax_paid_cumulative=out.tax_paid_cumulative[0],
        exit_tax=out.exit_tax[0],
    )


def simulate_portfolio_mc(
    params: PortfolioParams,
    horizon_years: int,
    mc_params: MonteCarloParams,
    ipca: float = 0.0,
) -> MonteCarloResult:
    """Monte Carlo simulation of the diversified portfolio.

    Draws GROSS total returns for each asset from N(gross_return, volatility²)
    independently, then routes them through the tax-aware core
    (_simulate_taxed_classes) so trajectories are net-of-redemption — identical
    semantics to the deterministic path when sigma=0. Contributions follow the
    same PMT-begin convention as simulate_portfolio.

    Draws are clamped at −0.99 after sampling: a drawn total return ≤ −100%
    would sign-flip rf-tranche growth-factor ratios, producing nonsensical
    negative balances; −99% caps the loss at near-total.
    """
    if horizon_years <= 0:
        raise ValueError("horizon_years must be positive")

    rng = np.random.default_rng(mc_params.seed)
    N, T = mc_params.n_trajectories, horizon_years
    K = len(params.assets)

    means = np.array([a.gross_return for a in params.assets])
    sigmas = np.array([a.volatility for a in params.assets])
    draws = _draw_normal_returns(rng, mean=means, sigma=sigmas, shape=(N, T, K))
    # Floor: a drawn total return <= -100% would sign-flip growth factors
    # (rf tranche ratios); -99% caps the loss at near-total.
    draws = np.maximum(draws, -0.99)

    out = _simulate_taxed_classes(params, T, draws, ipca, reinvest_income=True)
    trajectories = out.net

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
        gross_patrimony=patrimony.copy(),
        tax_paid_cumulative=np.zeros_like(patrimony),
        exit_tax=np.zeros_like(patrimony),
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
