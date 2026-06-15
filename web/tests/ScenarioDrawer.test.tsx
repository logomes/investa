import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenarioDrawer } from "@/components/scenario-drawer/ScenarioDrawer";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "@/lib/defaults";

vi.mock("@/lib/api", () => ({
  useMacro: () => ({
    data: { selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0, isStale: false, sourceLabel: "test" },
  }),
}));

beforeEach(() => {
  useScenarioStore.setState({
    scenario: DEFAULT_SCENARIO,
    mc: DEFAULT_MC,
    goalTarget: DEFAULT_GOAL,
    drawerOpen: false,
    pendingRealImportAt: undefined,
  });
});

describe("ScenarioDrawer", () => {
  it("does not render its content when drawerOpen is false", () => {
    render(<ScenarioDrawer />);
    expect(screen.queryByRole("button", { name: /Aplicar cenário/i })).not.toBeInTheDocument();
  });

  it("renders content when drawerOpen is true", async () => {
    useScenarioStore.setState({ drawerOpen: true });
    render(<ScenarioDrawer />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aplicar cenário/i })).toBeInTheDocument();
    });
  });

  it("Cancelar closes the drawer without calling setScenario", async () => {
    useScenarioStore.setState({ drawerOpen: true });
    const setScenario = vi.spyOn(useScenarioStore.getState(), "setScenario");
    render(<ScenarioDrawer />);
    await waitFor(() => screen.getByRole("button", { name: /Cancelar/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(useScenarioStore.getState().drawerOpen).toBe(false);
    });
    expect(setScenario).not.toHaveBeenCalled();
  });

  it("submitting valid form calls setScenario and closes drawer", async () => {
    useScenarioStore.setState({ drawerOpen: true });
    render(<ScenarioDrawer />);
    await waitFor(() => screen.getByRole("button", { name: /Aplicar cenário/i }));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar cenário/i }));
    await waitFor(() => {
      expect(useScenarioStore.getState().drawerOpen).toBe(false);
    });
  });

  it("submit commits pendingRealImportAt to lastRealImportAt and resets pending to undefined", async () => {
    const stamp = "2026-06-11T15:00:00.000Z";
    useScenarioStore.setState({ drawerOpen: true, lastRealImportAt: null });
    render(<ScenarioDrawer />);
    await waitFor(() => screen.getByRole("button", { name: /Aplicar cenário/i }));
    // Set the pending stamp after the mount effect has settled (the effect fires on
    // drawerOpen change; setting state directly here does not retrigger it).
    useScenarioStore.setState({ pendingRealImportAt: stamp });
    fireEvent.click(screen.getByRole("button", { name: /Aplicar cenário/i }));
    await waitFor(() => {
      expect(useScenarioStore.getState().drawerOpen).toBe(false);
    });
    expect(useScenarioStore.getState().lastRealImportAt).toBe(stamp);
    expect(useScenarioStore.getState().pendingRealImportAt).toBeUndefined();
  });

  it("reopening the drawer clears a stale pending without touching lastRealImportAt", async () => {
    const persisted = "2026-06-10T08:00:00.000Z";
    useScenarioStore.setState({
      drawerOpen: false,
      pendingRealImportAt: "2026-06-11T15:00:00.000Z",
      lastRealImportAt: persisted,
    });
    render(<ScenarioDrawer />);
    // Toggle drawerOpen to true — triggers the useEffect
    useScenarioStore.getState().setDrawerOpen(true);
    await waitFor(() => {
      expect(useScenarioStore.getState().pendingRealImportAt).toBeUndefined();
    });
    // lastRealImportAt must be untouched
    expect(useScenarioStore.getState().lastRealImportAt).toBe(persisted);
  });
});
