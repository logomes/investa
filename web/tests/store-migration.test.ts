import { describe, it, expect, beforeEach } from "vitest";
import { useScenarioStore } from "@/lib/store";

const V3_PAYLOAD = {
  state: {
    scenario: {
      capital: 111_000,
      horizon: 7,
      reinvest: true,
      realEstate: { propertyValue: 230_000, monthlyRent: 1_500 },
      portfolio: {
        capital: 111_000,
        monthlyContribution: 500,
        contributionInflationIndexed: true,
        assets: [],
      },
      benchmark: { selicRate: 0.12, taxRate: 0.2 },
    },
    mc: { nTrajectories: 2000, seed: null, targetPatrimony: 0 },
    goalTarget: 500_000,
  },
  version: 0,  // pre-v4 stores were written without a version option (zustand default 0)
};

describe("store migration v3 → v4", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reshapes the persisted benchmark, preserving the Selic intent", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect(s.scenario.benchmark).toEqual({
      kind: "selic",
      annualRate: 0.12,
      ipcaSpread: 0,
      taxRate: 0.2,
    });
  });

  it("keeps all other persisted fields intact", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect(s.scenario.capital).toBe(111_000);
    expect(s.scenario.horizon).toBe(7);
    expect(s.scenario.portfolio.monthlyContribution).toBe(500);
    expect(s.goalTarget).toBe(500_000);
  });

  it("leaves already-migrated v4 data untouched (kind survives)", async () => {
    localStorage.setItem(
      "investa-scenario-v3",
      JSON.stringify({
        state: {
          ...V3_PAYLOAD.state,
          scenario: {
            ...V3_PAYLOAD.state.scenario,
            benchmark: { kind: "ipca_plus", annualRate: 0.105, ipcaSpread: 0.06, taxRate: 0.15 },
          },
        },
        version: 4,
      }),
    );
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect(s.scenario.benchmark).toEqual({
      kind: "ipca_plus",
      annualRate: 0.105,
      ipcaSpread: 0.06,
      taxRate: 0.15,
    });
    expect("realEstate" in s.scenario).toBe(false);
  });
});

describe("store migration v5: realEstate dropped", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("v5 drops realEstate from the persisted scenario", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    const s = useScenarioStore.getState();
    expect("realEstate" in s.scenario).toBe(false);
  });
});
