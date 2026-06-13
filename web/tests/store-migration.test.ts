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

describe("lastRealImportAt provenance field", () => {
  beforeEach(() => {
    localStorage.clear();
    useScenarioStore.setState({ lastRealImportAt: null });
  });

  it("hydrates lastRealImportAt as null for pre-existing payloads", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().lastRealImportAt).toBeNull();
  });

  it("persists lastRealImportAt through the partialize", async () => {
    useScenarioStore.getState().setLastRealImportAt("2026-06-11T12:00:00.000Z");
    const raw = JSON.parse(localStorage.getItem("investa-scenario-v3")!);
    expect(raw.state.lastRealImportAt).toBe("2026-06-11T12:00:00.000Z");
  });
});

describe("store v6: expectedInflation + displayMode", () => {
  beforeEach(() => {
    localStorage.clear();
    useScenarioStore.setState({ displayMode: "real" });
  });

  it("injects expectedInflation into pre-v6 scenarios", async () => {
    localStorage.setItem("investa-scenario-v3", JSON.stringify(V3_PAYLOAD));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().scenario.expectedInflation).toBe(0.045);
  });

  it("keeps an existing expectedInflation untouched when the v6 branch runs", async () => {
    const payload = {
      state: {
        ...V3_PAYLOAD.state,
        scenario: { ...V3_PAYLOAD.state.scenario, expectedInflation: 0.07 },
      },
      version: 5,
    };
    localStorage.setItem("investa-scenario-v3", JSON.stringify(payload));
    await useScenarioStore.persist.rehydrate();
    expect(useScenarioStore.getState().scenario.expectedInflation).toBe(0.07);
  });

  it("displayMode defaults to real and persists through partialize", () => {
    expect(useScenarioStore.getState().displayMode).toBe("real");
    useScenarioStore.getState().setDisplayMode("nominal");
    const raw = JSON.parse(localStorage.getItem("investa-scenario-v3")!);
    expect(raw.state.displayMode).toBe("nominal");
  });
});

describe("store v7: taxProfile stamping", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function preV7Payload(assets: Array<{ name: string; taxProfile?: string }>) {
    return {
      state: {
        scenario: {
          ...V3_PAYLOAD.state.scenario,
          expectedInflation: 0.045,
          portfolio: {
            ...V3_PAYLOAD.state.scenario.portfolio,
            assets,
          },
        },
        mc: V3_PAYLOAD.state.mc,
        goalTarget: V3_PAYLOAD.state.goalTarget,
      },
      version: 6,
    };
  }

  it("stamps the catalog profile on an asset named like a catalog label", async () => {
    localStorage.setItem(
      "investa-scenario-v3",
      JSON.stringify(preV7Payload([{ name: "FII (Papel/Tijolo/Agro/FoF)" }])),
    );
    await useScenarioStore.persist.rehydrate();
    const a = useScenarioStore.getState().scenario.portfolio.assets[0];
    expect(a.taxProfile).toBe("fii");
  });

  it("stamps tributado_anual on an asset with no catalog match", async () => {
    localStorage.setItem(
      "investa-scenario-v3",
      JSON.stringify(preV7Payload([{ name: "Carteira Custom XYZ" }])),
    );
    await useScenarioStore.persist.rehydrate();
    const a = useScenarioStore.getState().scenario.portfolio.assets[0];
    expect(a.taxProfile).toBe("tributado_anual");
  });

  it("leaves an already-set taxProfile untouched on a v7 payload", async () => {
    localStorage.setItem(
      "investa-scenario-v3",
      JSON.stringify({
        ...preV7Payload([{ name: "FII (Papel/Tijolo/Agro/FoF)", taxProfile: "isento" }]),
        version: 7,
      }),
    );
    await useScenarioStore.persist.rehydrate();
    const a = useScenarioStore.getState().scenario.portfolio.assets[0];
    expect(a.taxProfile).toBe("isento");
  });
});
