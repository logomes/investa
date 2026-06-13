import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SimulateInput, MonteCarloInput, DisplayMode } from "./api-types";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "./defaults";
import { profileForAssetName } from "./portfolio-asset-types";

type ScenarioStore = {
  scenario: SimulateInput;
  mc: MonteCarloInput;
  goalTarget: number;
  drawerOpen: boolean;
  lastRealImportAt: string | null;
  // Pending provenance change from the open drawer session: undefined = no
  // change, string = stamp on submit, null = clear on submit. NOT persisted.
  pendingRealImportAt: string | null | undefined;
  displayMode: DisplayMode;

  setScenario: (s: SimulateInput) => void;
  setMc: (mc: MonteCarloInput) => void;
  setGoalTarget: (v: number) => void;
  setDrawerOpen: (open: boolean) => void;
  resetToDefaults: () => void;
  setLastRealImportAt: (iso: string | null) => void;
  setPendingRealImportAt: (v: string | null | undefined) => void;
  setDisplayMode: (m: DisplayMode) => void;
};

export const useScenarioStore = create<ScenarioStore>()(
  persist(
    (set) => ({
      scenario: DEFAULT_SCENARIO,
      mc: DEFAULT_MC,
      goalTarget: DEFAULT_GOAL,
      drawerOpen: false,
      lastRealImportAt: null,
      pendingRealImportAt: undefined,
      displayMode: "real",

      setScenario: (scenario) => set({ scenario }),
      setMc: (mc) => set({ mc }),
      setGoalTarget: (goalTarget) => set({ goalTarget }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      resetToDefaults: () =>
        set({
          scenario: DEFAULT_SCENARIO,
          mc: DEFAULT_MC,
          goalTarget: DEFAULT_GOAL,
          lastRealImportAt: null,
        }),
      setLastRealImportAt: (lastRealImportAt) => set({ lastRealImportAt }),
      setPendingRealImportAt: (pendingRealImportAt) => set({ pendingRealImportAt }),
      setDisplayMode: (displayMode) => set({ displayMode }),
    }),
    {
      // Storage key name is historical — do NOT rename (renaming drops user data).
      // Schema changes are handled via `version` + `migrate` below.
      name: "investa-scenario-v3",
      // v4: benchmark reshaped from {selicRate,taxRate} to {kind,annualRate,ipcaSpread,taxRate}.
      // v5: realEstate dropped from the persisted scenario (imóvel removed from the product).
      // v6: expectedInflation became a scenario field.
      // v7: assets gained taxProfile (stamped from the catalog by name).
      version: 7,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          scenario?: SimulateInput & {
            benchmark?: Partial<SimulateInput["benchmark"]> & { selicRate?: number };
            realEstate?: unknown;
            expectedInflation?: number;
            portfolio?: { assets?: Array<{ name: string; taxProfile?: string }> };
          };
        };
        if ((version ?? 0) < 4 && state?.scenario) {
          const old = state.scenario.benchmark ?? {};
          state.scenario.benchmark = {
            kind: "selic",  // pre-v4 benchmark was Tesouro Selic — preserve intent
            annualRate: old.selicRate ?? DEFAULT_SCENARIO.benchmark.annualRate,
            ipcaSpread: 0,
            taxRate: old.taxRate ?? DEFAULT_SCENARIO.benchmark.taxRate,
          };
        }
        if ((version ?? 0) < 5 && state?.scenario) {
          delete state.scenario.realEstate;
        }
        // v6: expectedInflation became a scenario field (persisted scenario
        // replaces the default wholesale, so shallow merge can't inject it).
        if ((version ?? 0) < 6 && state?.scenario) {
          if (state.scenario.expectedInflation === undefined) {
            state.scenario.expectedInflation = DEFAULT_SCENARIO.expectedInflation;
          }
        }
        // v7: stamp taxProfile on each asset by matching its name against the
        // catalog labels (unknown name → tributado_anual).
        if ((version ?? 0) < 7 && state?.scenario?.portfolio?.assets) {
          for (const a of state.scenario.portfolio.assets) {
            if (a.taxProfile === undefined) {
              a.taxProfile = profileForAssetName(a.name);
            }
          }
        }
        return state;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        mc: state.mc,
        goalTarget: state.goalTarget,
        lastRealImportAt: state.lastRealImportAt,
        displayMode: state.displayMode,
      }),
      skipHydration: true,
    }
  )
);
