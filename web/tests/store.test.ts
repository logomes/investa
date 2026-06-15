import { describe, it, expect, beforeEach } from "vitest";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "@/lib/defaults";

describe("scenario store", () => {
  beforeEach(() => {
    useScenarioStore.setState({
      scenario: DEFAULT_SCENARIO,
      mc: DEFAULT_MC,
      goalTarget: DEFAULT_GOAL,
      drawerOpen: false,
    });
  });

  it("starts with default scenario / mc / goal", () => {
    const s = useScenarioStore.getState();
    expect(s.scenario).toEqual(DEFAULT_SCENARIO);
    expect(s.mc).toEqual(DEFAULT_MC);
    expect(s.goalTarget).toBe(DEFAULT_GOAL);
    expect(s.drawerOpen).toBe(false);
  });

  it("setScenario replaces the entire scenario object", () => {
    const next = { ...DEFAULT_SCENARIO, capital: 500_000 };
    useScenarioStore.getState().setScenario(next);
    expect(useScenarioStore.getState().scenario.capital).toBe(500_000);
  });

  it("setGoalTarget updates only the goal", () => {
    useScenarioStore.getState().setGoalTarget(800_000);
    expect(useScenarioStore.getState().goalTarget).toBe(800_000);
    expect(useScenarioStore.getState().scenario).toEqual(DEFAULT_SCENARIO);
  });

  it("setDrawerOpen toggles visibility", () => {
    useScenarioStore.getState().setDrawerOpen(true);
    expect(useScenarioStore.getState().drawerOpen).toBe(true);
    useScenarioStore.getState().setDrawerOpen(false);
    expect(useScenarioStore.getState().drawerOpen).toBe(false);
  });

  it("resetToDefaults restores scenario, mc, and goal (drawer untouched)", () => {
    useScenarioStore.getState().setScenario({ ...DEFAULT_SCENARIO, capital: 999 });
    useScenarioStore.getState().setGoalTarget(123);
    useScenarioStore.getState().setDrawerOpen(true);
    useScenarioStore.setState({ lastRealImportAt: "2026-06-11T12:00:00.000Z" });
    useScenarioStore.getState().resetToDefaults();
    const s = useScenarioStore.getState();
    expect(s.scenario).toEqual(DEFAULT_SCENARIO);
    expect(s.goalTarget).toBe(DEFAULT_GOAL);
    expect(s.drawerOpen).toBe(true);  // not affected
    expect(s.lastRealImportAt).toBeNull();
  });
});
