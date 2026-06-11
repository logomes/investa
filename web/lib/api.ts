import { useQuery } from "@tanstack/react-query";
import { useScenarioStore } from "./store";
import type {
  SimulateOut,
  SimulateMonteCarloInput,
  SimulateMonteCarloOut,
  MacroOut,
} from "./api-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Optional Cloudflare Worker proxy that caches /api/macro on the edge.
// When set, useMacro hits this URL instead of `${API_URL}/api/macro`,
// absorbing Render cold starts. Falls back to API_URL when unset.
const MACRO_URL = process.env.NEXT_PUBLIC_MACRO_URL ?? `${API_URL}/api/macro`;

export class ApiError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(`API ${status}: ${bodyText}`);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return (await res.json()) as T;
}

// Stable JSON for queryKey: sorts keys recursively to avoid spurious refetches.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function useSimulate() {
  const scenario = useScenarioStore((s) => s.scenario);
  return useQuery({
    queryKey: ["simulate", stableStringify(scenario)],
    queryFn: () => postJson<SimulateOut>("/api/simulate", scenario),
    staleTime: Infinity,
    retry: 1,
  });
}

export function useMonteCarlo() {
  const scenario = useScenarioStore((s) => s.scenario);
  const mc = useScenarioStore((s) => s.mc);
  const payload: SimulateMonteCarloInput = {
    horizon: scenario.horizon,
    portfolio: scenario.portfolio,
    mc,
  };
  return useQuery({
    queryKey: ["simulate-mc", stableStringify(payload)],
    queryFn: () => postJson<SimulateMonteCarloOut>("/api/simulate/monte-carlo", payload),
    staleTime: Infinity,
    retry: 1,
  });
}

async function fetchMacro(): Promise<MacroOut> {
  const res = await fetch(MACRO_URL);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return (await res.json()) as MacroOut;
}

export function useMacro() {
  return useQuery({
    queryKey: ["macro"],
    queryFn: () => fetchMacro(),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
