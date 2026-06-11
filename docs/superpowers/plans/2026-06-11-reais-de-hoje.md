# Reais de Hoje Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Global "R$ de hoje | Nominal" display mode (default real) deflating every projection surface by a user-editable scenario inflation, plus real×inflation decomposition.

**Architecture:** Inflation becomes a scenario parameter (`expectedInflation`) sent to the API (fallback to server macro when absent). Deflation happens at the render edge via a pure `deflate.ts` + a `useDeflation()` hook; a persisted `displayMode` in the store drives all surfaces. Decomposition = KPI sub-copy + an inflation-loss band on the EvolutionCard.

**Tech Stack:** FastAPI/Pydantic v2, Next.js 14 + TS strict, Zustand persist (v6 migration), react-hook-form/zod, vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-reais-de-hoje-design.md` (Approved). One documented addition vs the spec: `SimulateMonteCarloInput` ALSO gains `expected_inflation` — the MC endpoint uses `macro.ipca` server-side today; without the field, deterministic series and MC bands would use different inflations.

**Repo:** `/home/lucgomes/workspace/investa`, branch `feat/reais-de-hoje` (stacked on `feat/portfolio-bridge`, already checked out). API tests: `cd api && .venv/bin/python -m pytest -q` (140 passed, 1 skipped). Web: `cd web && npx vitest run` (470), `npx tsc --noEmit`, `npm run lint`, `npx playwright test` (16).

---

### Task 1: Backend — `expected_inflation` scenario parameter

**Files:**
- Modify: `api/schemas/inputs.py` (SimulateInput, SimulateMonteCarloInput, GoalSolveInput)
- Modify: `api/routers/simulation.py` (resolve helper + 3 endpoints)
- Test: `api/tests/test_expected_inflation.py` (new)

- [ ] **Step 1.1: Write the failing tests**

Create `api/tests/test_expected_inflation.py` (mirror the TestClient pattern of `api/tests/test_endpoint_simulate.py` — read it first; it has a `_default_payload()`-style helper):

```python
"""expected_inflation: scenario-level inflation overriding the server macro."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _simulate_payload(**overrides) -> dict:
    base = {
        "capital": 100_000.0,
        "horizon": 5,
        "reinvest": True,
        "portfolio": {
            "capital": 100_000.0,
            "monthlyContribution": 1_000.0,
            "contributionInflationIndexed": True,
            "assets": [{
                "name": "A", "weight": 1.0, "expectedYield": 0.10,
                "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.10,
            }],
        },
        "benchmark": {"kind": "cdi", "annualRate": 0.10, "taxRate": 0.175},
    }
    base.update(overrides)
    return base


def test_simulate_accepts_and_honors_expected_inflation():
    lo = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.0)).json()
    hi = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.20)).json()
    # indexed contributions grow with inflation → higher final patrimony
    assert hi["portfolio"]["patrimony"][-1] > lo["portfolio"]["patrimony"][-1]


def test_simulate_without_field_still_works():
    resp = client.post("/api/simulate", json=_simulate_payload())
    assert resp.status_code == 200


def test_simulate_rejects_out_of_range_inflation():
    resp = client.post("/api/simulate", json=_simulate_payload(expectedInflation=0.9))
    assert resp.status_code == 422


def test_monte_carlo_accepts_expected_inflation():
    payload = {
        "horizon": 5,
        "portfolio": _simulate_payload()["portfolio"],
        "mc": {"nTrajectories": 200, "seed": 1, "targetPatrimony": 0},
        "expectedInflation": 0.10,
    }
    resp = client.post("/api/simulate/monte-carlo", json=payload)
    assert resp.status_code == 200


def test_goal_solve_accepts_expected_inflation():
    payload = {
        "horizon": 5,
        "goalTarget": 500_000,
        "portfolio": _simulate_payload()["portfolio"],
        "expectedInflation": 0.10,
    }
    resp = client.post("/api/goal/solve", json=payload)
    assert resp.status_code == 200
```

- [ ] **Step 1.2: Run to verify failure**

Run: `cd api && .venv/bin/python -m pytest tests/test_expected_inflation.py -v`
Expected: the honors-test FAILS (pydantic ignores the unknown field today, so lo == hi) and the 422 test fails.

- [ ] **Step 1.3: Schemas**

In `api/schemas/inputs.py`, add to `SimulateInput`, `SimulateMonteCarloInput` AND `GoalSolveInput` (same line in each, after their existing fields):

```python
    expected_inflation: float | None = Field(default=None, ge=0, le=0.5)
```

- [ ] **Step 1.4: Router**

In `api/routers/simulation.py`, add near the other helpers:

```python
def _resolve_ipca(expected_inflation: float | None) -> float:
    """Scenario-provided inflation wins; otherwise fall back to live macro."""
    if expected_inflation is not None:
        return expected_inflation
    return get_macro_params().ipca
```

Then in each endpoint replace the macro-ipca plumbing:
- `simulate()`: replace `macro = get_macro_params()` with `ipca = _resolve_ipca(payload.expected_inflation)` and pass `ipca=ipca` to `simulate_portfolio`, `simulate_benchmark`, `sensitivity_portfolio` (3 call sites — currently `ipca=macro.ipca`).
- `simulate_monte_carlo()`: same swap for its `simulate_portfolio_mc(..., ipca=...)`.
- `goal_solve()`: same swap for `solve_goal_contribution(..., ipca=...)`.

(`get_macro_params` import stays — `_resolve_ipca` uses it.)

- [ ] **Step 1.5: Run the full suite**

Run: `cd api && .venv/bin/python -m pytest -q`
Expected: 145 passed, 1 skipped (140 + 5 new).

- [ ] **Step 1.6: Commit**

```bash
git add api/schemas/inputs.py api/routers/simulation.py api/tests/test_expected_inflation.py
git commit -m "feat(api): expected_inflation scenario parameter with macro fallback"
```

---

### Task 2: Web core — `deflate.ts`, types, defaults, store v6

**Files:**
- Create: `web/lib/deflate.ts`
- Modify: `web/lib/api-types.ts`, `web/lib/defaults.ts`, `web/lib/store.ts`
- Test: `web/tests/deflate.test.ts` (new), `web/tests/store-migration.test.ts` (extend)

- [ ] **Step 2.1: Write the failing deflate tests**

Create `web/tests/deflate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deflationFactor, deflateAt, deflateSeries } from "@/lib/deflate";

describe("deflate", () => {
  it("factor is (1+ipca)^-years", () => {
    expect(deflationFactor(0.10, 2)).toBeCloseTo(1 / 1.21);
    expect(deflationFactor(0.10, 0)).toBe(1);
  });

  it("ipca 0 is the identity", () => {
    expect(deflateAt(1_000, 0, 10)).toBe(1_000);
    expect(deflateSeries([100, 200, 300], 0)).toEqual([100, 200, 300]);
  });

  it("deflateSeries uses the index as the year", () => {
    const real = deflateSeries([1_000, 1_000, 1_000], 0.10);
    expect(real[0]).toBeCloseTo(1_000);
    expect(real[1]).toBeCloseTo(1_000 / 1.1);
    expect(real[2]).toBeCloseTo(1_000 / 1.21);
  });

  it("deflateAt matches the series convention", () => {
    expect(deflateAt(1_000, 0.10, 2)).toBeCloseTo(826.4462, 3);
  });
});
```

Run: `cd web && npx vitest run tests/deflate.test.ts` — FAIL (module missing).

- [ ] **Step 2.2: Implement `web/lib/deflate.ts`**

```ts
/**
 * Deflation to "reais de hoje": divide nominal values by (1+ipca)^years.
 * Pure math — the display mode that decides WHEN to apply this lives in the
 * scenario store; components combine both via useDeflation().
 */

export function deflationFactor(ipca: number, years: number): number {
  return Math.pow(1 + ipca, -years);
}

export function deflateAt(value: number, ipca: number, years: number): number {
  return value * deflationFactor(ipca, years);
}

/** Index = year (series start at year 0, like SimulationResultOut arrays). */
export function deflateSeries(values: readonly number[], ipca: number): number[] {
  return values.map((v, year) => deflateAt(v, ipca, year));
}
```

- [ ] **Step 2.3: Types + defaults**

`web/lib/api-types.ts`:
- `SimulateInput` gains `expectedInflation: number;`
- `SimulateMonteCarloInput` gains `expectedInflation: number;`
- `GoalSolveInput` gains `expectedInflation: number;`
- New export near the store-ish types: `export type DisplayMode = "real" | "nominal";`

`web/lib/defaults.ts`: add to `DEFAULT_SCENARIO` (top level, after `reinvest`):

```ts
  expectedInflation: 0.045,  // prefilled placeholder; user edits in the drawer (BCB live value shown as caption)
```

- [ ] **Step 2.4: Failing store tests**

Append to `web/tests/store-migration.test.ts` (V3_PAYLOAD's scenario has NO expectedInflation — perfect):

```ts
describe("store v6: expectedInflation + displayMode", () => {
  beforeEach(() => {
    localStorage.clear();
    useScenarioStore.setState({ displayMode: "real" });
  });

  it("injects expectedInflation into pre-v6 scenarios", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().scenario.expectedInflation).toBe(0.045);
  });

  it("keeps an existing expectedInflation untouched", async () => {
    const payload = {
      state: {
        ...V3_PAYLOAD.state,
        scenario: { ...V3_PAYLOAD.state.scenario, expectedInflation: 0.07 },
      },
      version: 6,
    };
    localStorage.setItem("investa-scenario-v3", JSON.stringify(payload));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().scenario.expectedInflation).toBe(0.07);
  });

  it("displayMode defaults to real and persists through partialize", () => {
    expect(useScenarioStore.getState().displayMode).toBe("real");
    useScenarioStore.getState().setDisplayMode("nominal");
    const raw = JSON.parse(localStorage.getItem("investa-scenario-v3")!);
    expect(raw.state.displayMode).toBe("nominal");
  });
});
```

Run targeted — FAIL.

- [ ] **Step 2.5: Store changes**

In `web/lib/store.ts`:
1. Type gains:

```ts
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
```

(import `DisplayMode` from `./api-types`.)

2. Initial state + setter:

```ts
      displayMode: "real",
      setDisplayMode: (displayMode) => set({ displayMode }),
```

3. `partialize` adds `displayMode: state.displayMode,`.
4. Bump `version: 5` → `version: 6`, extend the comment, and add to `migrate` (after the `<5` branch):

```ts
        // v6: expectedInflation became a scenario field (persisted scenario
        // replaces the default wholesale, so shallow merge can't inject it).
        if ((version ?? 0) < 6 && state?.scenario) {
          if (state.scenario.expectedInflation === undefined) {
            state.scenario.expectedInflation = DEFAULT_SCENARIO.expectedInflation;
          }
        }
```

(extend the migrate cast type with `expectedInflation?: number` on the scenario.)

- [ ] **Step 2.6: Run + fix trivial fallout + commit**

Run: `cd web && npx vitest run && npx tsc --noEmit`. `tsc` will flag scenario fixtures missing `expectedInflation` (tests building `SimulateInput` literals — e.g. api-types.test, e2e excluded from tsc). Add `expectedInflation: 0.045` to those fixtures. All green, then:

```bash
git add web/lib/deflate.ts web/lib/api-types.ts web/lib/defaults.ts web/lib/store.ts web/tests/
git commit -m "feat(web): deflate helpers, expectedInflation in scenario, displayMode store v6"
```

---

### Task 3: Wire `expectedInflation` end to end (drawer field + API payloads + GoalCard source)

**Files:**
- Modify: `web/components/scenario-drawer/sections/CapitalSection.tsx`, `web/components/scenario-drawer/schema.ts`, `web/lib/api.ts` (useMonteCarlo payload), `web/components/visao-geral/GoalCard.tsx` (recommend + handleSolve inflation source)
- Test: `web/tests/capital-section-inflation.test.tsx` (new), existing GoalCard test updated

- [ ] **Step 3.1: Failing drawer test**

Create `web/tests/capital-section-inflation.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { CapitalSection } from "@/components/scenario-drawer/sections/CapitalSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.051, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

function Wrapper() {
  const form = useForm({ defaultValues: { ...DEFAULT_SCENARIO } });
  return (
    <FormProvider {...form}>
      <CapitalSection />
    </FormProvider>
  );
}

describe("CapitalSection — inflação projetada", () => {
  it("renders the field prefilled from the scenario", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/Inflação projetada/i) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(0.045);
  });

  it("shows the live BCB value as caption without overwriting the field", () => {
    render(<Wrapper />);
    expect(screen.getByText(/BCB hoje: 5,1%/)).toBeInTheDocument();
    const input = screen.getByLabelText(/Inflação projetada/i) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(0.045); // not 0.051
  });
});
```

Run targeted — FAIL.

- [ ] **Step 3.2: Drawer field**

`web/components/scenario-drawer/schema.ts`: add to `scenarioFormSchema`:

```ts
  expectedInflation: z.number().min(0).max(0.5),
```

`web/components/scenario-drawer/sections/CapitalSection.tsx`: import `useMacro` from `@/lib/api` and `formatPercent` from `@/lib/format`; inside the component `const macro = useMacro();`; add after the "Reinvestir rendimentos" block:

```tsx
      <div className="space-y-1">
        <Label htmlFor="expected-inflation">Inflação projetada (IPCA)</Label>
        <Input
          id="expected-inflation"
          type="number"
          step="any"
          {...register("expectedInflation", { valueAsNumber: true })}
        />
        {macro.data && (
          <p className="text-[10px] text-ink-4">
            BCB hoje: {formatPercent(macro.data.ipca, 1)} — usada nos aportes indexados e na visão “R$ de hoje”.
          </p>
        )}
      </div>
```

NOTE: `formatPercent(0.051, 1)` must render "5,1%" — verify `web/lib/format.ts`'s formatPercent signature/output and adjust the test string to its exact output.

- [ ] **Step 3.3: API payloads + GoalCard source**

- `web/lib/api.ts` `useMonteCarlo`: payload gains `expectedInflation: scenario.expectedInflation,`.
- `web/components/visao-geral/GoalCard.tsx`:
  - `recommend({... expectedInflation: macro.data?.ipca ?? 0.04 })` → `expectedInflation: scenario.expectedInflation`. If `macro` becomes unused after this, remove the `useMacro()` call and import.
  - `handleSolve` mutation input gains `expectedInflation: scenario.expectedInflation,`.
- Update the GoalCard test's mutation-args assertion to include `expectedInflation: expect.any(Number)`.

- [ ] **Step 3.4: Run everything + commit**

Run: `cd web && npx vitest run && npx tsc --noEmit && npm run lint` — green. (ScenarioDrawer/portfolio-section tests mock `@/lib/api` with `useMacro` already; CapitalSection now calls it inside those renders — their factory mocks may need `useMacro` if missing; fix as needed.)

```bash
git add web/components/scenario-drawer/ web/lib/api.ts web/components/visao-geral/GoalCard.tsx web/tests/
git commit -m "feat(web): inflação projetada editável no drawer, fonte única p/ aportes e solver"
```

---

### Task 4: Display-mode plumbing — Topbar toggle, `useDeflation`, badge

**Files:**
- Create: `web/lib/use-deflation.ts`, `web/components/shell/DisplayModeBadge.tsx`
- Modify: `web/components/shell/Topbar.tsx`
- Test: `web/tests/use-deflation.test.tsx` (new), `web/tests/Topbar.test.tsx` (extend)

- [ ] **Step 4.1: Failing tests**

Create `web/tests/use-deflation.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeflation } from "@/lib/use-deflation";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO } from "@/lib/defaults";

describe("useDeflation", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      displayMode: "real",
      scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 },
    });
  });

  it("deflates in real mode", () => {
    const { result } = renderHook(() => useDeflation());
    expect(result.current.isReal).toBe(true);
    expect(result.current.at(1_210, 2)).toBeCloseTo(1_000);
    expect(result.current.series([100, 110])[1]).toBeCloseTo(100);
  });

  it("is the identity in nominal mode", () => {
    act(() => useScenarioStore.setState({ displayMode: "nominal" }));
    const { result } = renderHook(() => useDeflation());
    expect(result.current.isReal).toBe(false);
    expect(result.current.at(1_210, 2)).toBe(1_210);
    expect(result.current.series([100, 110])).toEqual([100, 110]);
  });
});
```

Add to `web/tests/Topbar.test.tsx` (its store mock pattern — extend the hoisted mocks or setState as the file does):

```tsx
  it("display-mode toggle flips the store", () => {
    render(<Topbar />);
    fireEvent.click(screen.getByRole("button", { name: /^Nominal$/i }));
    expect(useScenarioStore.getState().displayMode).toBe("nominal");
    fireEvent.click(screen.getByRole("button", { name: /R\$ de hoje/i }));
    expect(useScenarioStore.getState().displayMode).toBe("real");
  });
```

(If the Topbar test mocks the store module rather than using the real one, adapt: assert the setter mock was called.)

Run targeted — FAIL.

- [ ] **Step 4.2: `web/lib/use-deflation.ts`**

```ts
"use client";

import { useScenarioStore } from "./store";
import { deflateAt, deflateSeries } from "./deflate";

/** Display-mode-aware deflation: identity in nominal mode. */
export function useDeflation() {
  const displayMode = useScenarioStore((s) => s.displayMode);
  const ipca = useScenarioStore((s) => s.scenario.expectedInflation);
  const isReal = displayMode === "real";
  return {
    isReal,
    ipca,
    at: (value: number, years: number) => (isReal ? deflateAt(value, ipca, years) : value),
    series: (values: readonly number[]) => (isReal ? deflateSeries(values, ipca) : [...values]),
  };
}
```

- [ ] **Step 4.3: `web/components/shell/DisplayModeBadge.tsx`**

```tsx
"use client";

import { useScenarioStore } from "@/lib/store";

/** Chip shown next to card titles whenever values are in today's money. */
export function DisplayModeBadge() {
  const displayMode = useScenarioStore((s) => s.displayMode);
  if (displayMode !== "real") return null;
  return (
    <span className="text-[10px] font-medium text-brand-bright bg-brand-bright/10 px-1.5 py-0.5 rounded">
      R$ de hoje
    </span>
  );
}
```

- [ ] **Step 4.4: Topbar toggle**

In `web/components/shell/Topbar.tsx`, read `displayMode`/`setDisplayMode` from the store and add after the title block (visible from `md`, mirroring the search's responsive class):

```tsx
      <div className="hidden md:flex items-center gap-1 bg-bg-2 border border-line rounded-pill p-0.5">
        {([["real", "R$ de hoje"], ["nominal", "Nominal"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDisplayMode(mode)}
            className={`px-2.5 py-1 rounded-pill text-[11px] font-medium transition-colors ${
              displayMode === mode ? "bg-bg-3 text-ink" : "text-ink-3 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
```

- [ ] **Step 4.5: Run + commit**

`cd web && npx vitest run && npx tsc --noEmit && npm run lint` — green.

```bash
git add web/lib/use-deflation.ts web/components/shell/ web/tests/
git commit -m "feat(web): display-mode toggle (R$ de hoje | Nominal) + useDeflation"
```

---

### Task 5: Visão Geral surfaces (Evolution + decomposition, renda, comparativo, KPIs)

**Files:**
- Modify: `web/components/visao-geral/EvolutionCard.tsx`, `MonthlyIncomeCard.tsx`, `ComparativoTable.tsx`, `KpiRow.tsx`
- Test: extend `web/tests/evolution-card.test.tsx`, `monthly-income-card.test.tsx`, `comparativo-table.test.tsx`; the KpiRow coverage lives where its existing tests are (grep `KpiRow` in web/tests; create `kpi-row.test.tsx` if none).

For every test below: set the store to a deterministic inflation first —
`useScenarioStore.setState({ displayMode: "real", scenario: { ...DEFAULT_SCENARIO, expectedInflation: 0.10 } })` in the test body (and reset to `"nominal"`/defaults in beforeEach so existing nominal-value assertions stay valid; default-real means EXISTING tests asserting nominal values must either set nominal mode in their beforeEach or their fixtures must be re-asserted — prefer setting `displayMode: "nominal"` in each file's beforeEach and adding explicit real-mode tests).

- [ ] **Step 5.1: Failing tests first**

- `evolution-card.test.tsx`: real-mode test — with fixture portfolio patrimony `[100, 110, 121]` and ipca 0.10, the rendered series values become `[100, 100, 100]` (assert via the LineChart stub's serialized values, which the file's stub exposes; extend the stub to also emit `data-values` if needed). Also assert the decomposition band appears: bands count in real mode = 2 (MC band + inflação band) vs 1 in nominal; and the badge text "R$ de hoje" renders.
- `monthly-income-card.test.tsx`: real-mode — year-2 income value deflated by 1.21.
- `comparativo-table.test.tsx`: real-mode — final patrimony cell shows the deflated value.
- KpiRow test: real-mode — "Patrimônio projetado" shows deflated final; sub contains "inflação consome".

Run — FAIL.

- [ ] **Step 5.2: `EvolutionCard.tsx`**

Use the hook + decomposition:

```tsx
  const { isReal, series: deflate } = useDeflation();
```

After `const project = ...` (which slices/interpolates), deflate BEFORE interpolation: change `project` to

```tsx
  const project = (arr: number[]) => {
    const display = isReal ? deflate(arr) : arr;   // deflate at annual resolution
    const sliced = display.slice(0, sliceN);
    return isMonthly ? interpolateMonthly(sliced) : sliced;
  };
```

Series stay `[portfolio, benchmark]` (now mode-aware via `project`). Bands become:

```tsx
  const nominalPortfolio = data.portfolio.patrimony.slice(0, sliceN);
  const realPortfolio = deflate(data.portfolio.patrimony).slice(0, sliceN);

  const bands = !isMonthly
    ? [
        ...(mc.data
          ? [{
              name: `${mc.data.portfolio.label} p10–p90`,
              color: "rgba(39, 174, 96, 0.18)",
              lower: (isReal ? deflate(mc.data.portfolio.p10) : mc.data.portfolio.p10).slice(0, sliceN),
              upper: (isReal ? deflate(mc.data.portfolio.p90) : mc.data.portfolio.p90).slice(0, sliceN),
            }]
          : []),
        ...(isReal
          ? [{
              name: "Inflação (perda de poder de compra)",
              color: "rgba(255, 200, 87, 0.10)",
              lower: realPortfolio,
              upper: nominalPortfolio,
            }]
          : []),
      ]
    : undefined;
```

Add `<DisplayModeBadge />` next to the `<h3>` title; the legend list already maps `series` — append a static legend entry for the inflação band when `isReal` (amber swatch + the band name).

- [ ] **Step 5.3: `MonthlyIncomeCard.tsx`**

```tsx
  const { series: deflate } = useDeflation();
  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: deflate(data.portfolio.annualIncome).map((v) => v / 12) },
    { name: data.benchmark.label, color: data.benchmark.color, values: deflate(data.benchmark.annualIncome).map((v) => v / 12) },
  ];
```

(deflate the ANNUAL series, then divide — same factor.) Add `<DisplayModeBadge />` beside the title.

- [ ] **Step 5.4: `ComparativoTable.tsx`**

```tsx
  const { at } = useDeflation();
  // inside the row map:
  const final = at(s.patrimony[finalIdx], finalIdx);
  const monthly = at(s.annualIncome[finalIdx], finalIdx) / 12;
```

(yield ratio uses both deflated values → identical to nominal; leave its formula on the deflated pair or raw — assert in test it's unchanged.) Badge beside the header.

- [ ] **Step 5.5: `KpiRow.tsx` + decomposition KPI**

```tsx
  const { isReal, at, ipca } = useDeflation();
  const lastIdx = pf.patrimony.length - 1;
  const pfFinalNominal = pf.patrimony[lastIdx];
  const pfFinal = at(pfFinalNominal, lastIdx);
  const cagr = Math.pow(pfFinal / pfInitial, 1 / horizon) - 1;   // real CAGR in real mode
  const monthlyIncomeFinal = at(pf.annualIncome[lastIdx], lastIdx) / 12;
  const monthlyIncomeInitial = pf.annualIncome[1] / 12;          // year-1 ≈ today, leave nominal
```

First KpiCard in real mode:

```tsx
        sub={isReal
          ? `nominal ${formatRsK(pfFinalNominal)} · inflação consome ${formatRsK(pfFinalNominal - pfFinal)}`
          : "Cenário Carteira (mediana)"}
```

Goal-probability KPI: leave for Task 6 (GoalCard task also adjusts this KPI — see there). Drawdown KPI unchanged (percent).

- [ ] **Step 5.6: Run + commit**

`cd web && npx vitest run && npx tsc --noEmit` — green (fix any pre-existing test that implicitly assumed nominal: set `displayMode: "nominal"` in that file's beforeEach).

```bash
git add web/components/visao-geral/ web/tests/
git commit -m "feat(web): visão geral respeita R$ de hoje + decomposição da inflação"
```

---

### Task 6: Goal semantics (GoalCard + KpiRow probability)

**Files:**
- Modify: `web/components/visao-geral/GoalCard.tsx`, `web/components/visao-geral/KpiRow.tsx`
- Test: extend `web/tests/goal-card.test.tsx` (+ the KpiRow test file)

Semantics: the goal is in the ACTIVE mode's money. Real mode converts the goal to its
nominal equivalent before any comparison against nominal engine outputs:
`nominalGoal = goal / deflationFactor(ipca, horizon)`.

- [ ] **Step 6.1: Failing tests**

In `goal-card.test.tsx` (store-controlled fixtures; mc fixture distribution known):
- real mode: with ipca 0.10, horizon from fixture, assert the displayed probability equals `goalProbability(dist, goal * 1.1^h)` — pick fixture numbers so the two modes give DIFFERENT probabilities and assert both.
- real mode: `handleSolve` is called with `goalTarget` = inflated goal (assert `expect.closeTo`).
- caption "meta em R$ de hoje" visible in real mode only.

- [ ] **Step 6.2: GoalCard implementation**

```tsx
  const { isReal, ipca, at } = useDeflation();
  const nominalGoal = isReal ? goal / deflationFactor(ipca, scenario.horizon) : goal;
```

(import `deflationFactor` from `@/lib/deflate`.)
- `probability = mcReady ? goalProbability(mcDist, nominalGoal) : null;`
- `recommend({ goal: nominalGoal, ... })` (capital/projectedFinal stay nominal — recommend operates in nominal space).
- `handleSolve` sends `goalTarget: nominalGoal`.
- `current`/`today`/`progress`: `today` is year-0 (real ≡ nominal) — unchanged.
- Under the goal value, add when `isReal`: `<p className="text-[10px] text-ink-4">meta em R$ de hoje</p>`.
- The displayed projected values inside RecommendationBlock copy remain nominal-engine outputs; acceptable (recommendation text references aporte, not patrimony, except `projectedFinal` in the on-track state — wrap that one with `at(rec.projectedFinal, scenario.horizon)` passed down or leave nominal with the badge absent; SIMPLEST correct: pass `projectedFinalDisplay={at(...)}` and use it in the on-track copy).

- [ ] **Step 6.3: KpiRow probability KPI**

`probGoal` in `KpiRow.tsx` compares the MC distribution against the same nominal-equivalent goal:

```tsx
  const nominalGoal = isReal ? goal / deflationFactor(ipca, horizon) : goal;
  const probGoal = pfMc.finalDistribution.filter((v) => v >= nominalGoal).length / pfMc.finalDistribution.length;
```

- [ ] **Step 6.4: Run + commit**

```bash
git add web/components/visao-geral/ web/tests/
git commit -m "feat(web): meta em R$ de hoje — probabilidade e solver no espaço do modo ativo"
```

---

### Task 7: Risco + Sensibilidade surfaces

**Files:**
- Modify: `web/components/risco/RiscoPageContent.tsx`, `MCBandCard.tsx`, `DistributionCard.tsx`, `KpiRowRisco.tsx`; `web/components/sensibilidade/SensibilidadePageContent.tsx`, `KpiBaseCard.tsx`
- Test: extend `web/tests/risco-page.test.tsx`, `web/tests/sensibilidade-page.test.tsx`

Approach: deflate at the PAGE level (RiscoPageContent / SensibilidadePageContent) and keep
the cards dumb — they already take arrays/numbers as props. Pages import `useDeflation`.

- [ ] **Step 7.1: Failing tests**

- `risco-page.test.tsx`: real-mode test (set store ipca 0.10 + displayMode real) — KPI p50 shows the deflated value (fixture p50 last = 275k, horizon = years length − 1 from fixture → assert exact deflated rendering); histogram receives deflated distribution (assert via a rendered percentile label or extend the existing assertions).
- `sensibilidade-page.test.tsx`: real-mode — base KPI deflated by the horizon factor; tornado rows deflated.

- [ ] **Step 7.2: `RiscoPageContent.tsx`**

```tsx
  const { isReal, at, series: deflate } = useDeflation();
  const horizonYears = years.length - 1;

  const displayMc = isReal
    ? {
        ...data.portfolio,
        p10: deflate(data.portfolio.p10),
        p50: deflate(data.portfolio.p50),
        p90: deflate(data.portfolio.p90),
        finalDistribution: data.portfolio.finalDistribution.map((v) => at(v, horizonYears)),
      }
    : data.portfolio;
  const displayBenchmark = isReal ? { ...benchmark, patrimony: deflate(benchmark.patrimony) } : benchmark;
  const displayTarget = target; // meta digitada no drawer segue o modo ativo: em real mode ela JÁ é "R$ de hoje"
```

Pass `displayMc`/`displayBenchmark` down; `pfStats = riskStats({ result: displayMc, target, capitalInitial: capital })` (capitalInitial is year-0 → no deflation; lossRate semantics preserved). `benchmarkFinal` from displayBenchmark. Add `<DisplayModeBadge />` in MCBandCard/DistributionCard headers (pass-through or import directly in the cards — import directly, zero props).

NOTE on `target` (mc.targetPatrimony): it is user-typed in the drawer with no money-epoch
label; in real mode the distribution is deflated so the target is interpreted as today's
money automatically. Document with a one-line comment; no conversion.

- [ ] **Step 7.3: `SensibilidadePageContent.tsx`**

```tsx
  const { at } = useDeflation();
  const horizonFactorYears = scenario.horizon;
  const base = at(data.portfolio.patrimony[data.portfolio.patrimony.length - 1], horizonFactorYears);
  const rows = sortByImpact(enrichRows(
    data.sensitivity.map((r) => ({
      ...r,
      pessimistic: at(r.pessimistic, horizonFactorYears),
      optimistic: at(r.optimistic, horizonFactorYears),
    })),
    base,
  ));
```

`KpiBaseCard`: add `<DisplayModeBadge />` next to the label (import directly).

- [ ] **Step 7.4: Run + commit**

```bash
git add web/components/risco/ web/components/sensibilidade/ web/tests/
git commit -m "feat(web): risco e sensibilidade respeitam R$ de hoje"
```

---

### Task 8: Exportar + e2e + verification + docs

**Files:**
- Modify: `web/lib/exportar-csv.ts`, `web/components/exportar/ExportarPageContent.tsx`, `web/components/exportar/ExportPreviewCard.tsx`
- Create: e2e additions in `web/e2e/` (extend `smoke.spec.ts` or new `display-mode.spec.ts`)
- Modify: `docs/superpowers/FUTURE_IMPROVEMENTS.md`, spec status

- [ ] **Step 8.1: Failing exportar tests**

Extend `web/tests/exportar-csv.test.ts`:

```ts
describe("deflateRows", () => {
  it("deflates each row by its year", () => {
    const rows = [
      { scenario: "Carteira Diversificada", year: 0, patrimony: 100, annualIncome: 10, cumulativeIncome: 10 },
      { scenario: "Carteira Diversificada", year: 2, patrimony: 121, annualIncome: 12.1, cumulativeIncome: 24 },
    ];
    const real = deflateRows(rows, 0.10);
    expect(real[0].patrimony).toBeCloseTo(100);
    expect(real[1].patrimony).toBeCloseTo(100);
    expect(real[1].annualIncome).toBeCloseTo(10);
  });
});

describe("csvFilename com modo", () => {
  it("sufixa reais-de-hoje no modo real", () => {
    expect(csvFilename(10, "real")).toBe("simulacao_investa_10anos_reais-de-hoje.csv");
    expect(csvFilename(10, "nominal")).toBe("simulacao_investa_10anos.csv");
  });
});
```

(Existing `csvFilename(10)` single-arg assertions: update them to pass `"nominal"`.)

- [ ] **Step 8.2: Implement**

`web/lib/exportar-csv.ts`:

```ts
import { deflateAt } from "./deflate";
import type { DisplayMode } from "./api-types";

export function deflateRows(rows: readonly LongRow[], ipca: number): LongRow[] {
  return rows.map((r) => ({
    ...r,
    patrimony: deflateAt(r.patrimony, ipca, r.year),
    annualIncome: deflateAt(r.annualIncome, ipca, r.year),
    cumulativeIncome: deflateAt(r.cumulativeIncome, ipca, r.year),
  }));
}

export function csvFilename(horizonYears: number, mode: DisplayMode): string {
  const suffix = mode === "real" ? "_reais-de-hoje" : "";
  return `simulacao_investa_${horizonYears}anos${suffix}.csv`;
}
```

`ExportarPageContent.tsx`: `const { isReal, ipca } = useDeflation();` → `const rows = isReal ? deflateRows(buildLongFormatRows(sim.data!), ipca) : buildLongFormatRows(sim.data!);` and pass `mode={isReal ? "real" : "nominal"}` to the preview card. `ExportPreviewCard`: new `mode: DisplayMode` prop → `csvFilename(horizonYears, mode)`; header gains `<DisplayModeBadge />`.

- [ ] **Step 8.3: e2e**

New `web/e2e/display-mode.spec.ts` (mocked via the fixtures' `mockBackend`): load `/`, assert the EvolutionCard's last-value label differs after clicking "Nominal" in the Topbar toggle (mock portfolio patrimony grows, so real < nominal; read the two rendered `R$…k` labels). Keep it to one test.

- [ ] **Step 8.4: Full verification**

```bash
cd api && .venv/bin/python -m pytest -q          # 145 passed, 1 skipped
cd ../web && npx vitest run                       # report exact (≈ 490)
npx tsc --noEmit && npm run lint
npx playwright test                               # 17 passed
npm run build
```

- [ ] **Step 8.5: Docs + commit**

- `docs/superpowers/FUTURE_IMPROVEMENTS.md`: new shipped subsection "### Reais de hoje — ✅ shipped 2026-06-11" (2 lines: toggle global default real, inflação como parâmetro de cenário, decomposição; spec ref). Add a deferred note: "Deflação do /historico (IPCA realizado, série histórica BCB) — rodada futura."
- Spec `2026-06-11-reais-de-hoje-design.md`: Status → Implemented.

```bash
git add -A
git commit -m "feat: exportar em R$ de hoje + e2e do toggle — rodada 2 completa"
```

---

## Self-review notes (already applied)

- Spec §1 → T1+T2+T3 (schemas+router; types/defaults/store; drawer field+payload wiring). §2 → T2 (deflate.ts, displayMode) + T4 (toggle/hook/badge) + T5/T7/T8 (surfaces table fully covered: Evolution/Monthly/Comparativo/KpiRow in T5, GoalCard §3 in T6, Risco 3 cards + Sensibilidade in T7, Exportar in T8). §4 decomposition → T5 (KPI + band). §5 edges → ipca=0 identity test (T2), v6 migration (T2), API fallback (T1). §6 testing list mapped 1:1.
- Documented spec addition: `SimulateMonteCarloInput.expected_inflation` (T1) + `useMonteCarlo` payload (T3) — without it the MC bands would deflate with the user's ipca but be SIMULATED with the server's.
- Type consistency: `DisplayMode` defined in T2, used in T4 (store), T8 (csvFilename). `useDeflation()` shape `{ isReal, ipca, at, series }` consistent across T4–T8. `deflationFactor` imported directly only in T6 (goal inversion).
- Default-real flips existing nominal assertions: each touched test file sets `displayMode: "nominal"` in beforeEach for legacy tests + explicit real-mode tests (called out in T5).
