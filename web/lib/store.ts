import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SimulateInput, MonteCarloInput } from "./api-types";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "./defaults";

type ScenarioStore = {
  scenario: SimulateInput;
  mc: MonteCarloInput;
  goalTarget: number;
  drawerOpen: boolean;

  setScenario: (s: SimulateInput) => void;
  setMc: (mc: MonteCarloInput) => void;
  setGoalTarget: (v: number) => void;
  setDrawerOpen: (open: boolean) => void;
  resetToDefaults: () => void;
};

export const useScenarioStore = create<ScenarioStore>()(
  persist(
    (set) => ({
      scenario: DEFAULT_SCENARIO,
      mc: DEFAULT_MC,
      goalTarget: DEFAULT_GOAL,
      drawerOpen: false,

      setScenario: (scenario) => set({ scenario }),
      setMc: (mc) => set({ mc }),
      setGoalTarget: (goalTarget) => set({ goalTarget }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      resetToDefaults: () =>
        set({
          scenario: DEFAULT_SCENARIO,
          mc: DEFAULT_MC,
          goalTarget: DEFAULT_GOAL,
        }),
    }),
    {
      // v3: bumped from v2 to drop stale FII_PAPEL/FII_TIJOLO labels in
      // persisted portfolio rows (consolidated into a single "FIIs" entry).
      name: "investa-scenario-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        mc: state.mc,
        goalTarget: state.goalTarget,
      }),
      skipHydration: true,
    }
  )
);
