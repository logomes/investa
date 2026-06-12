# Tributação Forward (IR dentro da simulação) — Design

**Date:** 2026-06-12
**Status:** In review
**Owner:** lucgomes

## Context

Round 3 of the approved roadmap: ① ponte+solver (PR #2) → ② reais de hoje (PR #3) →
**③ tributação forward** → ④ copiloto IA. Branch `feat/tributacao-forward`, stacked on
`feat/reais-de-hoje` (train: main ← #1 ← #2 ← #3 ← this).

Market gap (research, jun/2026): Investidor10/Meus Dividendos solve IR retrospectively
(DARF). Nobody simulates forward — come-cotas drag, regressive brackets, exemptions and
PGBL/VGBL *inside* the projection. That's this round.

## Problem

The engine taxes yield with a static annual haircut (`expected_yield × (1 − taxRate)`)
in every path (deterministic, MC, sensitivity, benchmark). Two distortions:

1. **No deferral.** Annual taxation assumes everything is realized every year. In
   reality CDB/Tesouro defer IR to redemption — gross compounding then one exit tax —
   which is exactly what differentiates CDB from LCI, or a fundo (come-cotas kills the
   deferral) from an ETF. The current model can't show any of that.
2. **No time structure.** The regressive table (22,5%→15% by holding period), the
   semestral come-cotas, FII/dividend exemptions and capital-gain-only taxation at sale
   are all flattened into one static rate. `capital_gain` is currently never taxed at all.

User-approved goal: **faithful projection AND decision tools** (LCI vs CDB equivalence,
PGBL vs VGBL), with prev. as a **standalone comparator** (not a scenario asset class yet).

## Decisions (user-approved)

| Topic | Decision |
|---|---|
| Goal | Engine captures deferral/come-cotas/regressiva/exemptions in the projection; Tributação page becomes a forward decision tool |
| PGBL/VGBL | Standalone comparator card (inputs: renda tributável, aporte, alíquota marginal); NOT a scenario asset class this round |
| Engine approach | **B — gross accumulation + tax at realization events** (per-tranche regressive exit tax; come-cotas as annual drag; WHT annual) |
| Plan shape | One plan, two phases: A = engine/API, B = page + comparators |

## Out of scope

- Previdência as a scenario asset class (comparator only).
- Partial redemptions / FIFO lot accounting / monthly DARF (approach C, rejected).
- Real-estate-style products, JCP modeling, day-trade rates.
- Changing how the user inputs yields (still nominal gross-of-tax expected yields — see
  §1 note on yield semantics).

---

## 1. Tax profiles

New enum `TaxProfile` (backend `Literal` + TS union):
`"isento" | "fii" | "acoes_br" | "rf_regressiva" | "come_cotas" | "dividendos_exterior" | "tributado_anual"`.

`AssetClass` / `PortfolioAssetInput` gain `tax_profile: TaxProfile = "tributado_anual"`.
The existing `tax_rate` field stays and is used ONLY by the `tributado_anual` fallback.

Semantics per profile — split the asset's return into **yield** (distributed) and
**capital_gain** (accrued):

| Profile | Yield (annual) | Gain accrual | Exit (end of horizon) |
|---|---|---|---|
| `isento` (LCI/LCA) | tax-free | gross | none |
| `fii` | tax-free (rendimentos isentos PF) | gross | 20% on accumulated gain |
| `acoes_br` | tax-free (dividendos isentos) | gross | 15% on accumulated gain |
| `rf_regressiva` (CDB/Tesouro) | — (total return accrues gross; nothing distributed) | gross | regressive per TRANCHE on total accumulated earnings |
| `come_cotas` (fundos) | — (accrues) | gross | none extra (see drag) |
| `dividendos_exterior` (stocks/REITs/ETFs US) | 30% WHT annually (cash event) | gross | 15% on accumulated gain |
| `tributado_anual` (CUSTOM/fallback) | `yield × (1 − taxRate)` annually | untaxed | none — byte-identical to today's engine |

**Come-cotas drag**: 15% of each year's positive return, charged annually
(approximation of the semestral antecipação). At exit nothing extra is charged — the
correct behavior for holdings ≥ 720d whose final bracket is 15%; for shorter horizons
this slightly understates tax (documented approximation).

**Regressive per tranche** (`rf_regressiva` and the benchmark): contributions enter
begin-of-year (engine convention), so a tranche entering year `t` and redeemed at the
end of year `h` is held `h − t ≥ 1` years. Annual-resolution brackets:
`h − t ≥ 2 → 15%`, `h − t == 1 → 17,5%`. (22,5%/20% require sub-year holdings that the
annual engine cannot produce; documented.) The exit tax of a tranche is
`rate × (tranche_value_at_h − tranche_principal)`.

**Catalog defaults** (`PORTFOLIO_ASSET_TYPES` + `ASSET_CLASS_META`): FII→`fii`,
ACAO_BR_DIV/CRESC→`acoes_br`, ETF_BR→`acoes_br` (15% exit; annual `taxRate` 0.15 drops),
STOCK_US/REIT_US/ETF_US/BDR→`dividendos_exterior`, RF_PUBLICO→`rf_regressiva`,
RF_PRIVADO→`rf_regressiva`, CUSTOM→`tributado_anual`. The **bridge** derives per
position: RF with `isTaxExempt`→`isento`; everything else by class.

**Yield-semantics migration note**: today users enter `expectedYield` and the engine
nets it by `taxRate`. Under profiles, yields are interpreted GROSS and the profile does
the taxing. For exempt classes (FII, ações BR div) nothing changes (tax was already 0).
For US classes the 30% WHT replaces `taxRate: 0.30` — same net effect, now explicit.
For RF classes the static 10%/17,5% haircut becomes deferral + exit tax — values WILL
shift (correctly upward). The spec accepts this as the point of the round.

## 2. Engine (Fase A)

`simulate_portfolio` and `simulate_portfolio_mc` switch from blended-rate to
**per-class accumulation** (the MC already draws per class; the deterministic path
joins it):

- Each class compounds its gross return per its profile; annual tax events (WHT,
  come-cotas drag, tributado_anual haircut) reduce that class's balance in the year
  they occur. Contributions split across classes by weight, begin-of-year, tranche
  records kept as `(year, principal_per_class)`.
- For every year `y`, compute **net-of-redemption patrimony**: market value minus the
  exit tax that would be due if everything were redeemed at the end of year `y`
  (per-tranche for `rf_regressiva`, flat-on-gain for fii/acoes/dividendos_exterior).
  This net series IS the new `patrimony` (consistent with goals/probability: "what
  you'd have if you cashed out").
- `SimulationResult`/`SimulationResultOut` gain: `gross_patrimony: list[float]`
  (market value, latent tax inside), `tax_paid_cumulative: list[float]` (path taxes:
  WHT + come-cotas + tributado_anual), `exit_tax: list[float]` (the latent exit tax at
  each year). Invariant: `patrimony[y] = gross_patrimony[y] − exit_tax[y]`.
- `annual_income` keeps meaning the distributed yield (net of WHT where applicable).
- **MC**: per-class trajectories apply the same annual events stochastically (drag/WHT
  on the drawn return). Exit tax per trajectory at the horizon: per-tranche rates with
  the TRAJECTORY's accumulated gain, using the deterministic tranche principal schedule
  (contributions are deterministic even in MC — exact, not an approximation; the only
  approximation is pro-rating each class's stochastic gain across its tranches in
  proportion to the deterministic tranche values, documented).
- **Benchmark** becomes `rf_regressiva` (a CDI/Selic/IPCA+ position IS deferred RF):
  gross accumulation + per-tranche exit. The drawer's "IR sobre rendimentos" field is
  REMOVED (regressiva computed automatically); `BenchmarkInput.tax_rate` becomes
  optional-ignored for compat (accepted, unused), removed from the TS type and the form.
- **Sensitivity** ("IR efetivo ±5pp") no longer makes sense per-profile: the IR row is
  replaced by "Horizonte (−2a / +2a)" — varies `horizon_years`, which interacts with
  the regressive brackets and is a more meaningful lever now.
- **Goal solver** inherits everything (it calls `simulate_portfolio_mc`): solves
  against net-of-redemption patrimony — strictly better semantics.

Closed-form test anchors: `isento` ≡ gross compounding; `tributado_anual` ≡ current
engine output (regression pin); single-tranche `rf_regressiva` at horizon h:
`net = 1 + (g)(1−rate(h))` where `g = (1+r)^h − 1`; come-cotas ≡ compounding at
`r_net = r × (1 − 0.15)` when return is all-positive-yield.

## 3. API contract (Fase A)

- `SimulateOut.tax_comparison` is REPLACED by `tax_projection`:

```python
class TaxProjectionRowOut(_CamelModel):
    name: str                  # class name
    tax_profile: str
    tax_paid_path: float       # WHT + come-cotas + anual, accumulated to horizon
    exit_tax: float            # latent exit tax at horizon
    net_final: float
    gross_final: float

class TaxProjectionOut(_CamelModel):
    rows: list[TaxProjectionRowOut]          # per class + one row for the benchmark
    tax_paid_by_year: list[float]            # cumulative path taxes, portfolio
    exit_tax_by_year: list[float]            # latent exit tax per year, portfolio
```

- `SimulationResultOut` gains `gross_patrimony`, `tax_paid_cumulative`, `exit_tax`
  (all `list[float]`; present for portfolio AND benchmark).
- Old web clients: removed `taxComparison` would break the deployed Tributação page —
  acceptable: this train deploys together (same policy as rounds 1-2).

## 4. Página Tributação forward (Fase B)

Replaces the current annual-snapshot page:

- **KPIs**: IR total no horizonte (path + saída), alíquota efetiva
  (`IR total ÷ ganho bruto`), IR latente hoje→saída, economia por isenções
  (recomputa o portfólio com tudo `rf_regressiva` e mostra a diferença — "quanto suas
  isenções valem").
- **Gráfico**: área empilhada do IR acumulado por origem (caminho vs saída) ao longo
  dos anos (LineChart bands reuse).
- **Tabela por classe**: perfil, IR no caminho, IR na saída, líquido final, alíquota
  efetiva da classe (from `tax_projection.rows`).
- Tudo respeita o displayMode da rodada 2 (valores deflacionados em modo real, com os
  badges padrão).

## 5. Comparadores (Fase B)

**LCI vs CDB** (`web/lib/tax-compare.ts`, pure): given an LCI rate and the scenario
horizon, the CDB that nets the same:
`find r: 1 + ((1+r)^h − 1)(1 − rate(h)) = (1+lci)^h`, closed form
`r = (1 + ((1+lci)^h − 1)/(1 − rate(h)))^(1/h) − 1`, displayed also as % do CDI
(via macro). Card on the Tributação page with one input (taxa LCI, default from the
scenario's RF row if present) reading horizon from the scenario.

**PGBL vs VGBL** (`web/lib/previdencia.ts`, pure): inputs renda tributável anual,
aporte anual (capped at 12% da renda for the deduction), alíquota marginal IRPF
(select 7,5/15/22,5/27,5%), taxa de retorno (default: benchmark net rate), horizonte
(scenario). Model, annual steps to `h`:
- PGBL: invest `A` per year + reinvest the annual restitution `A × marginal` (treated
  as invested together in the same year); exit tax = **10% on TOTAL balance**
  (regressiva de previdência ≥10 anos; for `h < 10` use the tranche-correct rate per
  aporte: 35−5×⌊years/2⌋ %, floor 10%).
- VGBL: invest `A` per year; exit tax = same regressive rate **on gains only**.
- Output: líquido PGBL, líquido VGBL, diferença, and the verdict text ("PGBL vence se
  você usa a declaração completa e fica até X anos"). Card with the 4 inputs + result.

## 6. Failure modes & edges

- All-zero weights in a profile group / empty classes → skipped rows.
- `tributado_anual` keeps `taxRate` meaning — CUSTOM assets and old persisted
  scenarios behave exactly as today (profile default = `tributado_anual` for persisted
  rows lacking the field → **store migration v7** stamps catalog-default profiles onto
  known class names, `tributado_anual` otherwise; drawer rows editable via the asset
  dialog's new profile select).
- Negative MC returns in a come-cotas year → no drag on losses (drag only on positive
  return), no carryforward (documented simplification).
- Benchmark `tax_rate` input still accepted (ignored) for old clients.

## 7. Testing

- Engine: the four closed-form anchors (§2); per-tranche exit math hand-checked
  (capital + 2 aportes, h=3 → rates 15/15/17,5%); MC seed-stable; `tributado_anual`
  regression pin against pre-round outputs; benchmark deferral > flat-tax benchmark
  (sanity: deferral always nets ≥ annual haircut at same gross rate).
- API: new fields shape; tax_projection rows; sensitivity horizon row.
- Web: page KPIs/table/chart both display modes; comparator libs pure-math tests
  (PGBL>VGBL when marginal 27,5% & h≥10; VGBL≥PGBL when marginal 7,5%); store v7
  migration; bridge profile derivation (isTaxExempt→isento).
- e2e: Tributação page renders the forward view; comparator interaction.

## Risks

- **Engine rewrite risk**: per-class accumulation touches the hottest code. Mitigated
  by the `tributado_anual` regression pin (old outputs must be reproducible bit-for-bit
  under the fallback profile) and the closed-form anchors.
- **Result shifts**: RF and benchmark values move up (deferral) — intencional; release
  note in FUTURE_IMPROVEMENTS.
- **Stack depth**: 4th PR in the train. Merge order unchanged (#1→#2→#3→#4).
