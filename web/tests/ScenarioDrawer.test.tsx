import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenarioDrawer } from "@/components/scenario-drawer/ScenarioDrawer";
import { useScenarioStore } from "@/lib/store";
import { DEFAULT_SCENARIO, DEFAULT_MC, DEFAULT_GOAL } from "@/lib/defaults";

beforeEach(() => {
  useScenarioStore.setState({
    scenario: DEFAULT_SCENARIO,
    mc: DEFAULT_MC,
    goalTarget: DEFAULT_GOAL,
    drawerOpen: false,
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
});
