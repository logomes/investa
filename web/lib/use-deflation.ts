"use client";

import { useScenarioStore } from "./store";
import { deflateAt, deflateSeries } from "./deflate";

/**
 * Display-mode-aware deflation: identity in nominal mode.
 * Returned function identities are not render-stable; call during render, don't list them in hook deps.
 */
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
