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
