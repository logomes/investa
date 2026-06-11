# Portfolio Bridge + Goal Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click import of the real portfolio (`/ativos` + `/renda-fixa`) into the scenario, plus a Monte Carlo goal solver ("aporte para P(meta) ≥ 80%").

**Architecture:** A pure frontend module (`portfolio-bridge.ts`) aggregates localStorage positions into a `PortfolioInput` (class-level rows, value-weighted assumptions); the scenario drawer gets a snapshot-import button with preview. The solver is one new backend endpoint (`POST /api/goal/solve`) doing a seeded binary search over `simulate_portfolio_mc`, consumed by the GoalCard via a react-query mutation.

**Tech Stack:** Next.js 14 + TS strict + Zustand persist + react-hook-form + vitest/Playwright; FastAPI + Pydantic v2 (camelCase aliases) + numpy + pytest.

**Spec:** `docs/superpowers/specs/2026-06-11-portfolio-bridge-design.md` (Approved)

**Repo:** `/home/lucgomes/workspace/investa`. Python: `api/.venv/bin/python -m pytest -q` (currently 131 passed, 1 skipped). Web: `cd web && npx vitest run` (442), `npx tsc --noEmit`, `npm run lint`, `npx playwright test` (15).

**Branch:** built ON TOP of `refactor/remove-imovel` (the spec commit and the benchmark refactor live there; PR #1 not yet merged).

---

## Setup

- [ ] **Step 0.1: Create the branch**

```bash
cd /home/lucgomes/workspace/investa
git checkout refactor/remove-imovel && git pull
git checkout -b feat/portfolio-bridge
```

---

### Task 1: `web/lib/portfolio-bridge.ts` — pure aggregation module

**Files:**
- Create: `web/lib/portfolio-bridge.ts`
- Test: `web/tests/portfolio-bridge.test.ts`

Key reused helpers (already exist — do NOT reimplement):
- `assetMarketValueBRL(p, macro)` from `web/lib/patrimony-snapshot.ts` — `quantity × (currentPrice ?? avgPrice)`, USD × `macro.usdBrl`.
- `rfCurrentValue(p, macro, today)` and `effectiveAnnualRate(p, macro)` from `web/lib/fi-derive.ts`.
- `PORTFOLIO_TYPE_BY_ID` from `web/lib/portfolio-asset-types.ts` (labels + default taxRate/volatility per scenario class).

- [ ] **Step 1.1: Write the failing tests**

Create `web/tests/portfolio-bridge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bridgePortfolio } from "@/lib/portfolio-bridge";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { FixedIncomePosition } from "@/lib/fi-schema";
import type { MacroOut } from "@/lib/api-types";

const MACRO: MacroOut = {
  selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0,
  isStale: false, sourceLabel: "test",
};

function rv(partial: Partial<AssetPosition> & Pick<AssetPosition, "ticker" | "assetClass">): AssetPosition {
  return {
    id: partial.ticker,
    currency: "BRL",
    quantity: 100,
    avgPrice: 10,
    expectedYield: 0.10,
    capitalGain: 0.02,
    color: "#FFC857",
    ...partial,
  } as AssetPosition;
}

function rf(partial: Partial<FixedIncomePosition> & Pick<FixedIncomePosition, "name">): FixedIncomePosition {
  return {
    id: partial.name,
    initialAmount: 10_000,
    purchaseDate: "2026-06-11",  // 0 holding days → rfCurrentValue == initialAmount
    indexer: "cdi",
    rate: 1.0,
    maturityDate: null,
    isTaxExempt: false,
    color: "#5CC8FF",
    ...partial,
  } as FixedIncomePosition;
}

const NOW = new Date("2026-06-11T12:00:00Z");

const BASE_ARGS = {
  macro: MACRO,
  monthlyContribution: 1_500,
  contributionInflationIndexed: true,
  now: NOW,
};

describe("bridgePortfolio — RV grouping", () => {
  it("groups by class with value-weighted yields and Σweights = 1", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "HGLG11", assetClass: "FII", quantity: 100, avgPrice: 10, expectedYield: 0.10, capitalGain: 0.01 }),
        rv({ ticker: "KNCR11", assetClass: "FII", quantity: 300, avgPrice: 10, expectedYield: 0.14, capitalGain: 0.03 }),
        rv({ ticker: "ITSA4", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 60 }),
      ],
      fiPositions: [],
    })!;

    expect(result.totalBRL).toBe(1_000 + 3_000 + 6_000);
    const fii = result.portfolio.assets.find((a) => a.name === "FII (Papel/Tijolo/Agro/FoF)")!;
    // weighted: (1000×0.10 + 3000×0.14) / 4000
    expect(fii.expectedYield).toBeCloseTo(0.13);
    expect(fii.capitalGain).toBeCloseTo((1_000 * 0.01 + 3_000 * 0.03) / 4_000);
    expect(fii.weight).toBeCloseTo(4_000 / 10_000);
    expect(fii.note).toBe("HGLG11, KNCR11");
    const sum = result.portfolio.assets.reduce((s, a) => s + a.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("uses currentPrice over avgPrice and converts USD via macro", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "JNJ", assetClass: "STOCK_US", currency: "USD", quantity: 10, avgPrice: 100, currentPrice: 150 }),
      ],
      fiPositions: [],
    })!;
    expect(result.totalBRL).toBe(10 * 150 * 5.0);
  });

  it("puts BDRs in their own row with 15% tax and 0.20 volatility", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "AAPL34", assetClass: "BDR" })],
      fiPositions: [],
    })!;
    const bdr = result.portfolio.assets[0];
    expect(bdr.name).toBe("BDRs");
    expect(bdr.taxRate).toBe(0.15);
    expect(bdr.volatility).toBe(0.20);
  });

  it("truncates the note after 2 tickers", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: ["A11", "B11", "C11", "D11"].map((t) => rv({ ticker: t, assetClass: "FII" })),
      fiPositions: [],
    })!;
    expect(result.portfolio.assets[0].note).toBe("A11, B11 +2");
  });
});

describe("bridgePortfolio — RF grouping", () => {
  it("splits tesouro/isentos into RF_PUBLICO and the rest into RF_PRIVADO", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [],
      fiPositions: [
        rf({ name: "Tesouro IPCA+ 2035", indexer: "ipca", rate: 0.06, initialAmount: 20_000 }),
        rf({ name: "LCI Itaú", isTaxExempt: true, initialAmount: 10_000 }),
        rf({ name: "CDB Inter 110%", indexer: "cdi", rate: 1.10, initialAmount: 30_000 }),
      ],
    })!;
    const pub = result.portfolio.assets.find((a) => a.name === "Renda Fixa Tesouro/LCI")!;
    const priv = result.portfolio.assets.find((a) => a.name === "Renda Fixa CDB/Debênture")!;
    expect(pub.weight).toBeCloseTo(30_000 / 60_000);
    expect(priv.weight).toBeCloseTo(30_000 / 60_000);
    expect(priv.expectedYield).toBeCloseTo(0.149 * 1.10);  // effectiveAnnualRate cdi
    expect(pub.capitalGain).toBe(0);
    expect(result.rfBRL).toBeCloseTo(60_000);
  });
});

describe("bridgePortfolio — edges", () => {
  it("returns null when both stores are empty", () => {
    expect(bridgePortfolio({ ...BASE_ARGS, positions: [], fiPositions: [] })).toBeNull();
  });

  it("preserves the current aporte plan", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "HGLG11", assetClass: "FII" })],
      fiPositions: [],
    })!;
    expect(result.portfolio.monthlyContribution).toBe(1_500);
    expect(result.portfolio.contributionInflationIndexed).toBe(true);
    expect(result.portfolio.capital).toBe(result.totalBRL);
  });

  it("sorts asset rows by weight descending", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "ITSA4", assetClass: "ACAO_BR_DIVIDENDO", quantity: 10, avgPrice: 10 }),
        rv({ ticker: "HGLG11", assetClass: "FII", quantity: 1000, avgPrice: 10 }),
      ],
      fiPositions: [],
    })!;
    expect(result.portfolio.assets[0].name).toBe("FII (Papel/Tijolo/Agro/FoF)");
  });
});
```

- [ ] **Step 1.2: Run to verify failure**

Run: `cd web && npx vitest run tests/portfolio-bridge.test.ts`
Expected: FAIL — module `@/lib/portfolio-bridge` does not exist.

- [ ] **Step 1.3: Implement**

Create `web/lib/portfolio-bridge.ts`:

```ts
import type { AssetPosition, AssetClass } from "./ativos-schema";
import type { FixedIncomePosition } from "./fi-schema";
import type { MacroOut, PortfolioInput, PortfolioAssetInput } from "./api-types";
import { assetMarketValueBRL } from "./patrimony-snapshot";
import { rfCurrentValue, effectiveAnnualRate } from "./fi-derive";
import { PORTFOLIO_TYPE_BY_ID, type PortfolioAssetTypeId } from "./portfolio-asset-types";

export type BridgeResult = {
  portfolio: PortfolioInput;
  totalBRL: number;
  rvBRL: number;
  rfBRL: number;
  positionsCount: number;   // RV positions included
  rfCount: number;          // RF positions included
  skipped: string[];        // tickers/names excluded (non-positive value)
};

// /ativos classes → scenario catalog. BDR has no catalog entry (own row below).
const RV_CLASS_TO_TYPE: Record<Exclude<AssetClass, "BDR">, PortfolioAssetTypeId> = {
  FII: "FII",
  ACAO_BR_DIVIDENDO: "ACAO_BR_DIV",
  ACAO_BR_CRESCIMENTO: "ACAO_BR_CRESC",
  ETF_BR: "ETF_BR",
  STOCK_US: "STOCK_US",
  REIT_US: "REIT_US",
  ETF_US: "ETF_US",
};

const BDR_ROW = { name: "BDRs", taxRate: 0.15, volatility: 0.20 };

const TESOURO_REGEX = /tesouro|ntn|\btd\b/i;

type Acc = { value: number; yieldWeighted: number; gainWeighted: number; labels: string[] };

function emptyAcc(): Acc {
  return { value: 0, yieldWeighted: 0, gainWeighted: 0, labels: [] };
}

function note(labels: string[]): string {
  const shown = labels.slice(0, 2).join(", ");
  return labels.length > 2 ? `${shown} +${labels.length - 2}` : shown;
}

export function bridgePortfolio(args: {
  positions: readonly AssetPosition[];
  fiPositions: readonly FixedIncomePosition[];
  macro: MacroOut;
  monthlyContribution: number;
  contributionInflationIndexed: boolean;
  now?: Date;
}): BridgeResult | null {
  const { positions, fiPositions, macro, now = new Date() } = args;
  if (positions.length === 0 && fiPositions.length === 0) return null;

  const skipped: string[] = [];

  const rvGroups = new Map<AssetClass, Acc>();
  let rvBRL = 0;
  let positionsCount = 0;
  for (const p of positions) {
    const value = assetMarketValueBRL(p, macro);
    if (!(value > 0)) {
      skipped.push(p.ticker);
      continue;
    }
    rvBRL += value;
    positionsCount += 1;
    const acc = rvGroups.get(p.assetClass) ?? emptyAcc();
    acc.value += value;
    acc.yieldWeighted += value * p.expectedYield;
    acc.gainWeighted += value * p.capitalGain;
    acc.labels.push(p.ticker);
    rvGroups.set(p.assetClass, acc);
  }

  const rfGroups: Record<"RF_PUBLICO" | "RF_PRIVADO", Acc> = {
    RF_PUBLICO: emptyAcc(),
    RF_PRIVADO: emptyAcc(),
  };
  let rfBRL = 0;
  let rfCount = 0;
  for (const p of fiPositions) {
    const value = rfCurrentValue(p, macro, now);
    if (!(value > 0)) {
      skipped.push(p.name);
      continue;
    }
    rfBRL += value;
    rfCount += 1;
    const bucket = p.isTaxExempt || TESOURO_REGEX.test(p.name) ? "RF_PUBLICO" : "RF_PRIVADO";
    const acc = rfGroups[bucket];
    acc.value += value;
    acc.yieldWeighted += value * effectiveAnnualRate(p, macro);
    acc.labels.push(p.name);
  }

  const totalBRL = rvBRL + rfBRL;
  if (!(totalBRL > 0)) return null;

  const assets: PortfolioAssetInput[] = [];

  for (const [cls, acc] of rvGroups) {
    const meta =
      cls === "BDR"
        ? BDR_ROW
        : (() => {
            const t = PORTFOLIO_TYPE_BY_ID[RV_CLASS_TO_TYPE[cls]];
            return { name: t.label, taxRate: t.defaults.taxRate, volatility: t.defaults.volatility };
          })();
    assets.push({
      name: meta.name,
      weight: acc.value / totalBRL,
      expectedYield: acc.yieldWeighted / acc.value,
      capitalGain: acc.gainWeighted / acc.value,
      taxRate: meta.taxRate,
      note: note(acc.labels),
      volatility: meta.volatility,
    });
  }

  for (const bucket of ["RF_PUBLICO", "RF_PRIVADO"] as const) {
    const acc = rfGroups[bucket];
    if (acc.value <= 0) continue;
    const t = PORTFOLIO_TYPE_BY_ID[bucket];
    assets.push({
      name: t.label,
      weight: acc.value / totalBRL,
      expectedYield: acc.yieldWeighted / acc.value,
      capitalGain: 0,
      taxRate: t.defaults.taxRate,
      note: note(acc.labels),
      volatility: t.defaults.volatility,
    });
  }

  assets.sort((a, b) => b.weight - a.weight);

  // Re-normalize so the drawer's Σ=1±0.001 zod refine always holds.
  const sum = assets.reduce((s, a) => s + a.weight, 0);
  for (const a of assets) a.weight = a.weight / sum;

  return {
    portfolio: {
      capital: totalBRL,
      monthlyContribution: args.monthlyContribution,
      contributionInflationIndexed: args.contributionInflationIndexed,
      assets,
    },
    totalBRL,
    rvBRL,
    rfBRL,
    positionsCount,
    rfCount,
    skipped,
  };
}
```

- [ ] **Step 1.4: Run tests**

Run: `cd web && npx vitest run tests/portfolio-bridge.test.ts && npx tsc --noEmit`
Expected: 8 tests PASS, tsc clean.

- [ ] **Step 1.5: Commit**

```bash
git add web/lib/portfolio-bridge.ts web/tests/portfolio-bridge.test.ts
git commit -m "feat(web): portfolio bridge — real positions to scenario PortfolioInput"
```

---

### Task 2: Store — `lastRealImportAt` provenance field

**Files:**
- Modify: `web/lib/store.ts`
- Test: extend `web/tests/store-migration.test.ts`

- [ ] **Step 2.1: Write the failing test**

Append to `web/tests/store-migration.test.ts` (reuses `V3_PAYLOAD`/beforeEach):

```ts
  it("hydrates lastRealImportAt as null for pre-existing payloads", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().lastRealImportAt).toBeNull();
  });

  it("persists lastRealImportAt through the partialize", async () => {
    useScenarioStore.getState().setLastRealImportAt("2026-06-11T12:00:00.000Z");
    const raw = JSON.parse(localStorage.getItem("investa-scenario-v3")!);
    expect(raw.state.lastRealImportAt).toBe("2026-06-11T12:00:00.000Z");
  });
```

Run: `cd web && npx vitest run tests/store-migration.test.ts` — FAIL (no such field/setter).

- [ ] **Step 2.2: Implement**

In `web/lib/store.ts`:
1. `ScenarioStore` type gains:

```ts
  lastRealImportAt: string | null;
  setLastRealImportAt: (iso: string | null) => void;
```

2. Initial state + action (inside the `(set) => ({...})`):

```ts
      lastRealImportAt: null,
      setLastRealImportAt: (lastRealImportAt) => set({ lastRealImportAt }),
```

3. `partialize` adds `lastRealImportAt: state.lastRealImportAt,`.

No version bump: the field is additive and zustand's default shallow merge fills missing persisted keys from initial state (the new test pins this).

- [ ] **Step 2.3: Run + commit**

Run: `cd web && npx vitest run tests/store-migration.test.ts && npx tsc --noEmit` → PASS/clean.

```bash
git add web/lib/store.ts web/tests/store-migration.test.ts
git commit -m "feat(web): lastRealImportAt provenance field in scenario store"
```

---

### Task 3: Drawer — "Usar carteira real" with inline preview

**Files:**
- Modify: `web/components/scenario-drawer/sections/PortfolioSection.tsx`
- Test: `web/tests/portfolio-section-import.test.tsx` (new)

UI contract: a third small outline button ("Usar carteira real", icon `Download` from lucide) next to the existing Adicionar/Reset buttons. Click computes the bridge into local state and renders an inline confirmation panel (no new dialog dependency) showing total, class count, position counts and skipped list, with "Substituir cenário" / "Cancelar". Confirm replaces form values and stamps the store. A caption below the section header shows the last import. Disabled when there is no data or macro hasn't loaded.

- [ ] **Step 3.1: Write the failing tests**

Create `web/tests/portfolio-section-import.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { PortfolioSection } from "@/components/scenario-drawer/sections/PortfolioSection";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import { useAssetsStore } from "@/lib/ativos-store";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { useScenarioStore } from "@/lib/store";
import type { ScenarioFormValues } from "@/components/scenario-drawer/schema";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

let lastValues: ScenarioFormValues | null = null;

function Wrapper() {
  const form = useForm<ScenarioFormValues>({
    defaultValues: { ...DEFAULT_SCENARIO, mc: { nTrajectories: 2000, seed: null, targetPatrimony: 0 } },
  });
  lastValues = null;
  return (
    <FormProvider {...form}>
      <PortfolioSection />
      <button type="button" onClick={() => { lastValues = form.getValues(); }}>read-form</button>
    </FormProvider>
  );
}

describe("PortfolioSection — Usar carteira real", () => {
  beforeEach(() => {
    localStorage.clear();
    useAssetsStore.setState({ positions: [] });
    useFixedIncomeStore.setState({ positions: [] });
    useScenarioStore.setState({ lastRealImportAt: null });
  });

  it("disables the button when there are no real positions", () => {
    render(<Wrapper />);
    expect(screen.getByRole("button", { name: /Usar carteira real/i })).toBeDisabled();
  });

  it("previews and replaces the form portfolio on confirm", () => {
    useAssetsStore.setState({
      positions: [{
        id: "HGLG11", ticker: "HGLG11", assetClass: "FII", currency: "BRL",
        quantity: 100, avgPrice: 100, expectedYield: 0.11, capitalGain: 0.01, color: "#FFC857",
      }],
    });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Usar carteira real/i }));
    expect(screen.getByText(/R\$\s*10\.000/)).toBeInTheDocument();   // preview total
    fireEvent.click(screen.getByRole("button", { name: /Substituir cenário/i }));
    fireEvent.click(screen.getByText("read-form"));
    expect(lastValues!.portfolio.assets).toHaveLength(1);
    expect(lastValues!.portfolio.assets[0].name).toBe("FII (Papel/Tijolo/Agro/FoF)");
    expect(lastValues!.portfolio.capital).toBe(10_000);
    expect(lastValues!.capital).toBe(10_000);
    expect(useScenarioStore.getState().lastRealImportAt).not.toBeNull();
    expect(screen.getByText(/Importado da carteira real em/i)).toBeInTheDocument();
  });

  it("cancel closes the preview without touching the form", () => {
    useAssetsStore.setState({
      positions: [{
        id: "HGLG11", ticker: "HGLG11", assetClass: "FII", currency: "BRL",
        quantity: 100, avgPrice: 100, expectedYield: 0.11, capitalGain: 0.01, color: "#FFC857",
      }],
    });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Usar carteira real/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    fireEvent.click(screen.getByText("read-form"));
    expect(lastValues!.portfolio.assets).toHaveLength(DEFAULT_SCENARIO.portfolio.assets.length);
    expect(useScenarioStore.getState().lastRealImportAt).toBeNull();
  });
});
```

Run: `cd web && npx vitest run tests/portfolio-section-import.test.tsx` — FAIL (no button).

- [ ] **Step 3.2: Implement in `PortfolioSection.tsx`**

1. Add imports:

```tsx
import { Plus, Pencil, Trash2, RotateCcw, Download } from "lucide-react";
import { useMacro } from "@/lib/api";
import { useAssetsStore } from "@/lib/ativos-store";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { useScenarioStore } from "@/lib/store";
import { bridgePortfolio, type BridgeResult } from "@/lib/portfolio-bridge";
import { formatPercent, formatRs } from "@/lib/format";
```

2. Inside the component (after the existing hooks; also add `setValue, getValues` to the `useFormContext` destructure):

```tsx
  const macro = useMacro();
  const realPositions = useAssetsStore((s) => s.positions);
  const fiPositions = useFixedIncomeStore((s) => s.positions);
  const lastRealImportAt = useScenarioStore((s) => s.lastRealImportAt);
  const setLastRealImportAt = useScenarioStore((s) => s.setLastRealImportAt);
  const [preview, setPreview] = useState<BridgeResult | null>(null);

  const canImport =
    !!macro.data && (realPositions.length > 0 || fiPositions.length > 0);

  const handlePreviewImport = () => {
    if (!macro.data) return;
    const current = getValues();
    const result = bridgePortfolio({
      positions: realPositions,
      fiPositions,
      macro: macro.data,
      monthlyContribution: current.portfolio.monthlyContribution,
      contributionInflationIndexed: current.portfolio.contributionInflationIndexed,
    });
    setPreview(result);
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    replace(preview.portfolio.assets);
    setValue("portfolio.capital", preview.portfolio.capital, { shouldDirty: true });
    setValue("capital", preview.portfolio.capital, { shouldDirty: true });
    setLastRealImportAt(new Date().toISOString());
    setPreview(null);
  };
```

3. Button (in the existing header button group, before Adicionar):

```tsx
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviewImport}
              disabled={!canImport}
              className="h-6 px-2 text-[11px]"
            >
              <Download className="w-3 h-3 mr-1" />
              Usar carteira real
            </Button>
```

4. Inline preview panel (right after the header `<div className="flex items-center justify-between">…</div>` block):

```tsx
        {preview && (
          <div className="bg-bg-3 border border-line rounded-card p-3 space-y-2">
            <p className="text-[12px] text-ink">
              <span className="font-semibold">{formatRs(preview.totalBRL)}</span>{" "}
              em {preview.portfolio.assets.length} classes
              ({preview.positionsCount} posições RV, {preview.rfCount} RF)
            </p>
            {preview.skipped.length > 0 && (
              <p className="text-[11px] text-accent-amber">
                Ignorados (valor zero): {preview.skipped.join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-6 px-2 text-[11px]" onClick={handleConfirmImport}>
                Substituir cenário
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setPreview(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {lastRealImportAt && (
          <p className="text-[10px] text-ink-4">
            Importado da carteira real em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            }).format(new Date(lastRealImportAt))}
          </p>
        )}
```

- [ ] **Step 3.3: Run everything**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: all green. NOTE: `web/tests/ScenarioDrawer.test.tsx` mocks `@/lib/api` with `useMacro` only — PortfolioSection now also calls it, which is covered. If the drawer test renders with empty asset/fi stores, the new button is simply disabled — no breakage expected; fix fixtures if anything trips.

- [ ] **Step 3.4: Commit**

```bash
git add web/components/scenario-drawer/sections/PortfolioSection.tsx web/tests/portfolio-section-import.test.tsx
git commit -m "feat(web): 'Usar carteira real' import with preview in scenario drawer"
```

---

### Task 4: Backend — `solve_goal_contribution` + `POST /api/goal/solve`

**Files:**
- Modify: `api/core/models.py` (new function after `sensitivity_portfolio`)
- Modify: `api/schemas/inputs.py` (GoalSolveInput), `api/schemas/outputs.py` (GoalSolveOut)
- Modify: `api/routers/simulation.py` (endpoint)
- Create: `api/tests/test_goal_solve.py`

- [ ] **Step 4.1: Write the failing tests**

Create `api/tests/test_goal_solve.py`. Trick: zero-volatility assets make the MC deterministic (every trajectory equals the mean path), so assertions are exact.

```python
"""Tests for the Monte Carlo goal solver."""
import pytest
from fastapi.testclient import TestClient

from core.config import AssetClass, PortfolioParams
from core.models import simulate_portfolio, solve_goal_contribution
from main import app

client = TestClient(app)


def _deterministic_portfolio() -> PortfolioParams:
    # volatility 0 → every MC trajectory equals the deterministic path
    return PortfolioParams(
        capital=100_000,
        monthly_contribution=0.0,
        contribution_inflation_indexed=False,
        assets=[AssetClass("A", 1.0, 0.10, 0.0, 0.0, volatility=0.0)],
    )


def test_returns_zero_when_goal_already_attainable():
    pf = _deterministic_portfolio()
    base_final = float(simulate_portfolio(pf, 10, reinvest_income=True).patrimony[-1])
    result = solve_goal_contribution(
        pf, horizon_years=10, goal_target=base_final * 0.9, confidence=0.8,
    )
    assert result["required_monthly_contribution"] == 0.0
    assert result["attainable"] is True
    assert result["achieved_probability"] == 1.0


def test_flags_unattainable_at_upper_bound():
    result = solve_goal_contribution(
        _deterministic_portfolio(),
        horizon_years=1, goal_target=100_000_000_000.0, confidence=0.8,
    )
    assert result["attainable"] is False
    assert result["required_monthly_contribution"] == 50_000.0


def test_finds_contribution_within_tolerance():
    pf = _deterministic_portfolio()
    base_final = float(simulate_portfolio(pf, 10, reinvest_income=True).patrimony[-1])
    goal = base_final + 100_000.0
    result = solve_goal_contribution(pf, horizon_years=10, goal_target=goal, confidence=0.8)
    assert result["attainable"] is True
    c = result["required_monthly_contribution"]
    assert c > 0

    # the returned contribution achieves the goal…
    from dataclasses import replace
    achieved = float(
        simulate_portfolio(replace(pf, monthly_contribution=c), 10, reinvest_income=True).patrimony[-1]
    )
    assert achieved >= goal
    # …and c − tolerance does not (i.e. the answer is tight)
    short = float(
        simulate_portfolio(replace(pf, monthly_contribution=max(c - 100, 0)), 10, reinvest_income=True).patrimony[-1]
    )
    assert short < goal


def test_is_reproducible():
    pf = _deterministic_portfolio()
    pf.assets[0].volatility = 0.15  # stochastic now; seed must pin the answer
    a = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.8)
    b = solve_goal_contribution(pf, horizon_years=10, goal_target=400_000, confidence=0.8)
    assert a == b


def _payload(**overrides) -> dict:
    base = {
        "horizon": 10,
        "goalTarget": 500_000,
        "portfolio": {
            "capital": 100_000,
            "monthlyContribution": 0,
            "contributionInflationIndexed": False,
            "assets": [{
                "name": "A", "weight": 1.0, "expectedYield": 0.10,
                "capitalGain": 0.0, "taxRate": 0.0, "note": "", "volatility": 0.10,
            }],
        },
    }
    base.update(overrides)
    return base


def test_endpoint_solves():
    resp = client.post("/api/goal/solve", json=_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {
        "requiredMonthlyContribution", "achievedProbability", "attainable", "iterations",
    }
    assert body["requiredMonthlyContribution"] >= 0


def test_endpoint_validates_confidence_bounds():
    resp = client.post("/api/goal/solve", json=_payload(confidence=0.3))
    assert resp.status_code == 422
```

- [ ] **Step 4.2: Run to verify failure**

Run: `cd api && .venv/bin/python -m pytest tests/test_goal_solve.py -v`
Expected: FAIL — `ImportError: cannot import name 'solve_goal_contribution'`.

- [ ] **Step 4.3: Implement the model function**

In `api/core/models.py`, add after `sensitivity_portfolio` (uses the existing `replace` import from `dataclasses` and `MonteCarloParams` from `.config`):

```python
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
        return float((result.final_distribution >= goal_target).mean())

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
```

- [ ] **Step 4.4: Schemas**

`api/schemas/inputs.py` — add after `SimulateMonteCarloInput`:

```python
class GoalSolveInput(_CamelModel):
    horizon: int = Field(ge=1, le=30)
    portfolio: PortfolioInput
    goal_target: float = Field(gt=0)
    confidence: float = Field(default=0.80, ge=0.5, le=0.99)
    n_trajectories: int = Field(default=1500, ge=100, le=1500)
```

(The spec's `mc: MonteCarloInput` collapsed to a single capped `n_trajectories` — seed/targetPatrimony were declared ignored anyway; this is the honest contract.)

`api/schemas/outputs.py` — add after `SimulateMonteCarloOut`:

```python
class GoalSolveOut(_CamelModel):
    required_monthly_contribution: float
    achieved_probability: float
    attainable: bool
    iterations: int
```

- [ ] **Step 4.5: Endpoint**

In `api/routers/simulation.py`: extend the `core.models` import with `solve_goal_contribution`, the schemas imports with `GoalSolveInput` / `GoalSolveOut`, and add:

```python
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
```

- [ ] **Step 4.6: Run + commit**

Run: `cd api && .venv/bin/python -m pytest -q`
Expected: 138 passed, 1 skipped (131 + 7 new).

```bash
git add api/core/models.py api/schemas/ api/routers/simulation.py api/tests/test_goal_solve.py
git commit -m "feat(api): goal solver — binary search over seeded Monte Carlo"
```

---

### Task 5: Frontend — types + `useGoalSolve` mutation

**Files:**
- Modify: `web/lib/api-types.ts`, `web/lib/api.ts`
- Test: extend `web/tests/api-types.test.ts` (shape only, follow the file's pattern)

- [ ] **Step 5.1: Types**

Append to `web/lib/api-types.ts`:

```ts
export type GoalSolveInput = {
  horizon: number;
  portfolio: PortfolioInput;
  goalTarget: number;
  confidence: number;
  nTrajectories: number;
};

export type GoalSolveOut = {
  requiredMonthlyContribution: number;
  achievedProbability: number;
  attainable: boolean;
  iterations: number;
};
```

- [ ] **Step 5.2: Mutation hook**

Append to `web/lib/api.ts` (extend the type import with `GoalSolveInput, GoalSolveOut`; `useMutation` comes from `@tanstack/react-query` — extend that import too):

```ts
export function useGoalSolve() {
  return useMutation({
    mutationFn: (input: GoalSolveInput) =>
      postJson<GoalSolveOut>("/api/goal/solve", input),
    retry: 1,
  });
}
```

- [ ] **Step 5.3: Run + commit**

Run: `cd web && npx tsc --noEmit && npx vitest run` → clean/green.

```bash
git add web/lib/api-types.ts web/lib/api.ts web/tests/
git commit -m "feat(web): useGoalSolve mutation"
```

---

### Task 6: GoalCard — "Refinar com Monte Carlo"

**Files:**
- Modify: `web/components/visao-geral/GoalCard.tsx`
- Test: extend `web/tests/goal-card.test.tsx`

- [ ] **Step 6.1: Write the failing tests**

In `web/tests/goal-card.test.tsx` (read its existing mocks first — it already mocks `@/lib/api`; the mock factory must now ALSO export `useGoalSolve`). Add a controllable mock:

```tsx
const goalSolveMock = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  data: undefined as undefined | {
    requiredMonthlyContribution: number;
    achievedProbability: number;
    attainable: boolean;
    iterations: number;
  },
};
// inside the existing vi.mock("@/lib/api", ...) factory:
//   useGoalSolve: () => goalSolveMock,
```

New tests:

```tsx
  it("renders the refine button and fires the mutation with the scenario", () => {
    render(<GoalCard />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Refinar com Monte Carlo/i }));
    expect(goalSolveMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 0.8, horizon: expect.any(Number) }),
    );
  });

  it("shows the solver result with an apply button", () => {
    goalSolveMock.data = {
      requiredMonthlyContribution: 2_345,
      achievedProbability: 0.82,
      attainable: true,
      iterations: 9,
    };
    render(<GoalCard />, { wrapper });
    expect(screen.getByText(/R\$\s*2\.345/)).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aplicar aporte refinado/i })).toBeInTheDocument();
  });

  it("renders the unattainable message", () => {
    goalSolveMock.data = {
      requiredMonthlyContribution: 50_000,
      achievedProbability: 0.4,
      attainable: false,
      iterations: 0,
    };
    render(<GoalCard />, { wrapper });
    expect(screen.getByText(/improvável mesmo com R\$\s*50\.000/i)).toBeInTheDocument();
  });
```

(Adapt `wrapper`/render helpers to the file's existing pattern; reset `goalSolveMock.data = undefined` in a `beforeEach`.)

Run: `cd web && npx vitest run tests/goal-card.test.tsx` — FAIL.

- [ ] **Step 6.2: Implement**

In `web/components/visao-geral/GoalCard.tsx`:

1. Import: `useGoalSolve` from `@/lib/api`.
2. Inside `GoalCard`, after the existing hooks:

```tsx
  const goalSolve = useGoalSolve();

  const handleSolve = () => {
    goalSolve.mutate({
      horizon: scenario.horizon,
      portfolio: scenario.portfolio,
      goalTarget: goal,
      confidence: 0.8,
      nTrajectories: 1500,
    });
  };
```

3. Below the `<RecommendationBlock …/>` (inside the same bordered footer div), add:

```tsx
        <div className="mt-3">
          {goalSolve.data ? (
            goalSolve.data.attainable ? (
              <div className="bg-bg-3 rounded-card p-3 space-y-2">
                <p className="text-[12px] text-ink-2 leading-relaxed">
                  Monte Carlo: <span className="text-ink font-semibold">{formatRs(goalSolve.data.requiredMonthlyContribution)}/mês</span>{" "}
                  para {formatPercent(0.8)} de confiança (P={formatPercent(goalSolve.data.achievedProbability)}).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const latest = useScenarioStore.getState().scenario;
                    setScenario({
                      ...latest,
                      portfolio: {
                        ...latest.portfolio,
                        monthlyContribution: goalSolve.data!.requiredMonthlyContribution,
                      },
                    });
                  }}
                  className="w-full text-[12px] font-semibold py-1.5 rounded-[10px] text-bg-0 shadow-glow hover:scale-[1.01] transition-transform"
                  style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
                >
                  Aplicar aporte refinado
                </button>
              </div>
            ) : (
              <p className="text-[11.5px] text-accent-coral">
                Meta improvável mesmo com {formatRs(goalSolve.data.requiredMonthlyContribution)}/mês — aumente horizonte ou reduza o alvo.
              </p>
            )
          ) : (
            <button
              type="button"
              onClick={handleSolve}
              disabled={goalSolve.isPending}
              className="w-full text-[12px] font-medium py-1.5 rounded-[10px] border border-line text-ink-2 hover:text-ink disabled:opacity-60"
            >
              {goalSolve.isPending ? "Calculando (Monte Carlo)… ~10s" : "Refinar com Monte Carlo"}
            </button>
          )}
          {goalSolve.isError && (
            <p className="text-[11px] text-accent-coral mt-1">
              Falha ao calcular — <button type="button" className="underline" onClick={handleSolve}>tentar de novo</button>
            </p>
          )}
        </div>
```

NOTE: the card is `h-[420px]` flex; if the new block overflows in the test snapshot/e2e, bump to `h-[480px]` and note it in the commit message.

- [ ] **Step 6.3: Run + commit**

Run: `cd web && npx vitest run && npx tsc --noEmit` → green/clean.

```bash
git add web/components/visao-geral/GoalCard.tsx web/tests/goal-card.test.tsx
git commit -m "feat(web): GoalCard MC refinement via /api/goal/solve"
```

---

### Task 7: e2e + full verification + docs

**Files:**
- Create: `web/e2e/bridge.spec.ts`
- Modify: `docs/superpowers/FUTURE_IMPROVEMENTS.md`, spec status

- [ ] **Step 7.1: e2e for the import flow**

Create `web/e2e/bridge.spec.ts`, following `web/e2e/ativos.spec.ts`'s localStorage-seeding pattern (`page.addInitScript` with the `investa-assets-v1` key — read that spec first and mirror its seed shape exactly):

```ts
import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/api-mocks";

test.describe("portfolio bridge", () => {
  test("imports the real portfolio into the scenario drawer", async ({ page }) => {
    await mockApiRoutes(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "investa-assets-v1",
        JSON.stringify({
          state: {
            positions: [{
              id: "HGLG11", ticker: "HGLG11", assetClass: "FII", currency: "BRL",
              quantity: 100, avgPrice: 100, expectedYield: 0.11, capitalGain: 0.01,
              color: "#FFC857",
            }],
            scheduledEvents: [], trades: [], proventsPaid: [],
          },
          version: 0,
        }),
      );
    });
    await page.goto("/");
    await page.getByRole("button", { name: /Simular cenário/i }).click();
    await page.getByRole("button", { name: /Usar carteira real/i }).click();
    await expect(page.getByText(/R\$\s*10\.000/)).toBeVisible();
    await page.getByRole("button", { name: /Substituir cenário/i }).click();
    await expect(page.getByText("FII (Papel/Tijolo/Agro/FoF)")).toBeVisible();
  });
});
```

(Verify the actual localStorage key/shape of the assets store in `web/e2e/ativos.spec.ts` and the persist `name` in `web/lib/ativos-store.ts` before running; adjust the seed to match.)

- [ ] **Step 7.2: Full verification**

```bash
cd api && .venv/bin/python -m pytest -q          # 138 passed, 1 skipped
cd ../web && npx vitest run                       # ~456 (report exact)
npx tsc --noEmit && npm run lint
npx playwright test                               # 16 passed
npm run build
```

- [ ] **Step 7.3: Docs**

- `docs/superpowers/FUTURE_IMPROVEMENTS.md`: under "Goal Card", mark the deferred binary-search item as shipped ("✅ shipped 2026-06-11 — `/api/goal/solve`, GoalCard 'Refinar com Monte Carlo'"). Add a one-line note under "Ativos" that the bridge shipped ("✅ Ponte carteira real → cenário — botão no drawer").
- `docs/superpowers/specs/2026-06-11-portfolio-bridge-design.md`: `Status: In review` → `Status: Implemented` (it is already user-approved; flip when this task's verification is green).

- [ ] **Step 7.4: Commit**

```bash
git add -A
git commit -m "feat: bridge e2e + docs — portfolio bridge round complete"
```

---

## Self-review notes (already applied)

- Spec coverage: bridge module (T1), provenance field (T2), drawer UI w/ preview+disabled states (T3), solver model+schemas+endpoint (T4), mutation (T5), GoalCard states incl. unattainable + error retry (T6), e2e + FUTURE_IMPROVEMENTS + spec status (T7). Spec's "mc: MonteCarloInput" input collapsed to capped `nTrajectories` — honest simplification, documented in T4.
- Type consistency: `BridgeResult` fields used in T3 preview match T1; `GoalSolveInput/Out` TS (T5) mirror the pydantic schemas (T4); `useGoalSolve` consumed in T6 as defined in T5.
- The drawer zod refine (Σ=1±0.001) is guaranteed by T1's re-normalization; the form-level write in T3 keeps Cancelar/Aplicar semantics.
- `RF_PUBLICO`/`RF_PRIVADO` are valid `PortfolioAssetTypeId`s (verified in `portfolio-asset-types.ts`).
