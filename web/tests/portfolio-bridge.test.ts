import { describe, it, expect } from "vitest";
import { bridgePortfolio } from "@/lib/portfolio-bridge";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { FixedIncomePosition } from "@/lib/fi-schema";
import type { MacroOut } from "@/lib/api-types";

const MACRO: MacroOut = {
  selic: 0.15, cdi: 0.149, ipca: 0.045, usdBrl: 5.0,
  isStale: false, sourceLabel: "test",
};

function rv(partial: Partial<AssetPosition> & Pick<AssetPosition, "ticker" | "assetClass">): AssetPosition {
  return {
    id: partial.ticker,
    currency: "BRL",
    quantity: 100,
    avgPrice: 10,
    expectedYield: 0.10,
    capitalGain: 0.02,
    color: "#FFC857",
    ...partial,
  } as AssetPosition;
}

function rf(partial: Partial<FixedIncomePosition> & Pick<FixedIncomePosition, "name">): FixedIncomePosition {
  return {
    id: partial.name,
    initialAmount: 10_000,
    purchaseDate: "2026-06-11",  // 0 holding days → rfCurrentValue == initialAmount
    indexer: "cdi",
    rate: 1.0,
    maturityDate: null,
    isTaxExempt: false,
    color: "#5CC8FF",
    ...partial,
  } as FixedIncomePosition;
}

const NOW = new Date("2026-06-11T12:00:00Z");

const BASE_ARGS = {
  macro: MACRO,
  monthlyContribution: 1_500,
  contributionInflationIndexed: true,
  now: NOW,
};

describe("bridgePortfolio — RV grouping", () => {
  it("groups by class with value-weighted yields and Σweights = 1", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "HGLG11", assetClass: "FII", quantity: 100, avgPrice: 10, expectedYield: 0.10, capitalGain: 0.01 }),
        rv({ ticker: "KNCR11", assetClass: "FII", quantity: 300, avgPrice: 10, expectedYield: 0.14, capitalGain: 0.03 }),
        rv({ ticker: "ITSA4", assetClass: "ACAO_BR_DIVIDENDO", quantity: 100, avgPrice: 60 }),
      ],
      fiPositions: [],
    })!;

    expect(result.totalBRL).toBe(1_000 + 3_000 + 6_000);
    const fii = result.portfolio.assets.find((a) => a.name === "FII (Papel/Tijolo/Agro/FoF)")!;
    // weighted: (1000×0.10 + 3000×0.14) / 4000
    expect(fii.expectedYield).toBeCloseTo(0.13);
    expect(fii.capitalGain).toBeCloseTo((1_000 * 0.01 + 3_000 * 0.03) / 4_000);
    expect(fii.weight).toBeCloseTo(4_000 / 10_000);
    expect(fii.note).toBe("HGLG11, KNCR11");
    const sum = result.portfolio.assets.reduce((s, a) => s + a.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("uses currentPrice over avgPrice and converts USD via macro", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "JNJ", assetClass: "STOCK_US", currency: "USD", quantity: 10, avgPrice: 100, currentPrice: 150 }),
      ],
      fiPositions: [],
    })!;
    expect(result.totalBRL).toBe(10 * 150 * 5.0);
  });

  it("puts BDRs in their own row with 15% tax and 0.20 volatility", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "AAPL34", assetClass: "BDR" })],
      fiPositions: [],
    })!;
    const bdr = result.portfolio.assets[0];
    expect(bdr.name).toBe("BDRs");
    expect(bdr.taxRate).toBe(0.15);
    expect(bdr.volatility).toBe(0.20);
  });

  it("truncates the note after 2 tickers", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: ["A11", "B11", "C11", "D11"].map((t) => rv({ ticker: t, assetClass: "FII" })),
      fiPositions: [],
    })!;
    expect(result.portfolio.assets[0].note).toBe("A11, B11 +2");
  });
});

describe("bridgePortfolio — RF grouping", () => {
  it("splits tesouro/isentos into RF_PUBLICO and the rest into RF_PRIVADO", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [],
      fiPositions: [
        rf({ name: "Tesouro IPCA+ 2035", indexer: "ipca", rate: 0.06, initialAmount: 20_000 }),
        rf({ name: "LCI Itaú", isTaxExempt: true, initialAmount: 10_000 }),
        rf({ name: "CDB Inter 110%", indexer: "cdi", rate: 1.10, initialAmount: 30_000 }),
      ],
    })!;
    const pub = result.portfolio.assets.find((a) => a.name === "Renda Fixa Tesouro/LCI")!;
    const priv = result.portfolio.assets.find((a) => a.name === "Renda Fixa CDB/Debênture")!;
    expect(pub.weight).toBeCloseTo(30_000 / 60_000);
    expect(priv.weight).toBeCloseTo(30_000 / 60_000);
    expect(priv.expectedYield).toBeCloseTo(0.149 * 1.10);  // effectiveAnnualRate cdi
    expect(pub.capitalGain).toBe(0);
    expect(result.rfBRL).toBeCloseTo(60_000);
  });
});

describe("bridgePortfolio — edges", () => {
  it("returns null when both stores are empty", () => {
    expect(bridgePortfolio({ ...BASE_ARGS, positions: [], fiPositions: [] })).toBeNull();
  });

  it("preserves the current aporte plan", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "HGLG11", assetClass: "FII" })],
      fiPositions: [],
    })!;
    expect(result.portfolio.monthlyContribution).toBe(1_500);
    expect(result.portfolio.contributionInflationIndexed).toBe(true);
    expect(result.portfolio.capital).toBe(result.totalBRL);
  });

  it("sorts asset rows by weight descending", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "ITSA4", assetClass: "ACAO_BR_DIVIDENDO", quantity: 10, avgPrice: 10 }),
        rv({ ticker: "HGLG11", assetClass: "FII", quantity: 1000, avgPrice: 10 }),
      ],
      fiPositions: [],
    })!;
    expect(result.portfolio.assets[0].name).toBe("FII (Papel/Tijolo/Agro/FoF)");
  });

  it("combines RV and RF against the same total", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "HGLG11", assetClass: "FII", quantity: 100, avgPrice: 100 })], // 10k
      fiPositions: [rf({ name: "CDB Inter", initialAmount: 30_000 })],                         // 30k
    })!;
    expect(result.totalBRL).toBeCloseTo(40_000);
    expect(result.rvBRL).toBeCloseTo(10_000);
    expect(result.rfBRL).toBeCloseTo(30_000);
    const fii = result.portfolio.assets.find((a) => a.name === "FII (Papel/Tijolo/Agro/FoF)")!;
    const rfRow = result.portfolio.assets.find((a) => a.name === "Renda Fixa CDB/Debênture")!;
    expect(fii.weight).toBeCloseTo(0.25);
    expect(rfRow.weight).toBeCloseTo(0.75);
    // sorted by weight desc: RF first
    expect(result.portfolio.assets[0].name).toBe("Renda Fixa CDB/Debênture");
  });

  it("returns null when every position is skipped, listing them", () => {
    // quantity 0 → market value 0 → skipped
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [rv({ ticker: "ZERO11", assetClass: "FII", quantity: 0 })],
      fiPositions: [],
    });
    expect(result).toBeNull();
  });

  it("collects skipped entries while keeping valid ones", () => {
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [
        rv({ ticker: "ZERO11", assetClass: "FII", quantity: 0 }),
        rv({ ticker: "HGLG11", assetClass: "FII" }),
      ],
      fiPositions: [],
    })!;
    expect(result.skipped).toEqual(["ZERO11"]);
    expect(result.positionsCount).toBe(1);
  });

  it("clamps an out-of-range RF rate to a valid expectedYield", () => {
    // fi-schema's rate is unbounded: a typo'd prefixado 150% a.a. must not
    // produce a row the drawer zod (max 1) and the API (le=1.0) reject.
    const result = bridgePortfolio({
      ...BASE_ARGS,
      positions: [],
      fiPositions: [rf({ name: "CDB typo", indexer: "prefixado", rate: 1.5 })],
    })!;
    const row = result.portfolio.assets.find((a) => a.name === "Renda Fixa CDB/Debênture")!;
    expect(row.expectedYield).toBe(1);
  });
});
