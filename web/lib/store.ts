import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SimulateInput, MonteCarloInput } from "./api-types";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "./defaults";

type ScenarioStore = {
  scenario: SimulateInput;
  mc: MonteCarloInput;
  goalTarget: number;
  drawerOpen: boolean;
  lastRealImportAt: string | null;

  setScenario: (s: SimulateInput) => void;
  setMc: (mc: MonteCarloInput) => void;
  setGoalTarget: (v: number) => void;
  setDrawerOpen: (open: boolean) => void;
  resetToDefaults: () => void;
  setLastRealImportAt: (iso: string | null) => void;
};

export const useScenarioStore = create<ScenarioStore>()(
  persist(
    (set) => ({
      scenario: DEFAULT_SCENARIO,
      mc: DEFAULT_MC,
      goalTarget: DEFAULT_GOAL,
      drawerOpen: false,
      lastRealImportAt: null,

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
    }),
    {
      // Storage key name is historical — do NOT rename (renaming drops user data).
      // Schema changes are handled via `version` + `migrate` below.
      name: "investa-scenario-v3",
      // v4: benchmark reshaped from {selicRate,taxRate} to {kind,annualRate,ipcaSpread,taxRate}.
      // v5: realEstate dropped from the persisted scenario (imóvel removed from the product).
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          scenario?: SimulateInput & {
            benchmark?: Partial<SimulateInput["benchmark"]> & { selicRate?: number };
            realEstate?: unknown;
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
        return state;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        mc: state.mc,
        goalTarget: state.goalTarget,
        lastRealImportAt: state.lastRealImportAt,
      }),
      skipHydration: true,
    }
  )
);
