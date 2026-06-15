import type { AssetPosition, AssetClass } from "./ativos-schema";
import type { FixedIncomePosition } from "./fi-schema";
import type { MacroOut, PortfolioInput, PortfolioAssetInput } from "./api-types";
import { assetMarketValueBRL } from "./patrimony-snapshot";
import { rfCurrentValue, effectiveAnnualRate } from "./fi-derive";
import { PORTFOLIO_TYPE_BY_ID, type PortfolioAssetTypeId } from "./portfolio-asset-types";

export type BridgeResult = {
  portfolio: PortfolioInput;
  totalBRL: number;
  rvBRL: number;
  rfBRL: number;
  positionsCount: number;   // RV positions included
  rfCount: number;          // RF positions included
  skipped: string[];        // tickers/names excluded (non-positive value)
};

// /ativos classes → scenario catalog. BDR has no catalog entry (own row below).
const RV_CLASS_TO_TYPE: Record<Exclude<AssetClass, "BDR">, PortfolioAssetTypeId> = {
  FII: "FII",
  ACAO_BR_DIVIDENDO: "ACAO_BR_DIV",
  ACAO_BR_CRESCIMENTO: "ACAO_BR_CRESC",
  ETF_BR: "ETF_BR",
  STOCK_US: "STOCK_US",
  REIT_US: "REIT_US",
  ETF_US: "ETF_US",
};

const BDR_ROW = { name: "BDRs", taxRate: 0.15, volatility: 0.20 };

const TESOURO_REGEX = /tesouro|ntn|\btd\b/i;

type Acc = { value: number; yieldWeighted: number; gainWeighted: number; labels: string[] };

function emptyAcc(): Acc {
  return { value: 0, yieldWeighted: 0, gainWeighted: 0, labels: [] };
}

function note(labels: string[]): string {
  const shown = labels.slice(0, 2).join(", ");
  return labels.length > 2 ? `${shown} +${labels.length - 2}` : shown;
}

// fi-schema's `rate` is unbounded, so a typo'd prefixado (e.g. 1.5 = 150% a.a.)
// would produce a row the drawer zod (max 1) and the API (le=1.0) both reject.
function clampYield(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function bridgePortfolio(args: {
  positions: readonly AssetPosition[];
  fiPositions: readonly FixedIncomePosition[];
  macro: MacroOut;
  monthlyContribution: number;
  contributionInflationIndexed: boolean;
  now?: Date;
}): BridgeResult | null {
  const { positions, fiPositions, macro, now = new Date() } = args;
  if (positions.length === 0 && fiPositions.length === 0) return null;

  const skipped: string[] = [];

  const rvGroups = new Map<AssetClass, Acc>();
  let rvBRL = 0;
  let positionsCount = 0;
  for (const p of positions) {
    const value = assetMarketValueBRL(p, macro);
    if (!(value > 0)) {
      skipped.push(p.ticker);
      continue;
    }
    rvBRL += value;
    positionsCount += 1;
    const acc = rvGroups.get(p.assetClass) ?? emptyAcc();
    acc.value += value;
    acc.yieldWeighted += value * p.expectedYield;
    acc.gainWeighted += value * p.capitalGain;
    acc.labels.push(p.ticker);
    rvGroups.set(p.assetClass, acc);
  }

  const rfGroups: Record<"RF_PUBLICO" | "RF_PRIVADO", Acc> = {
    RF_PUBLICO: emptyAcc(),
    RF_PRIVADO: emptyAcc(),
  };
  let rfBRL = 0;
  let rfCount = 0;
  for (const p of fiPositions) {
    const value = rfCurrentValue(p, macro, now);
    if (!(value > 0)) {
      skipped.push(p.name);
      continue;
    }
    rfBRL += value;
    rfCount += 1;
    const bucket = p.isTaxExempt || TESOURO_REGEX.test(p.name) ? "RF_PUBLICO" : "RF_PRIVADO";
    const acc = rfGroups[bucket];
    acc.value += value;
    acc.yieldWeighted += value * effectiveAnnualRate(p, macro);
    acc.labels.push(p.name);
  }

  const totalBRL = rvBRL + rfBRL;
  if (!(totalBRL > 0)) return null;

  const assets: PortfolioAssetInput[] = [];

  for (const [cls, acc] of Array.from(rvGroups.entries())) {
    const meta =
      cls === "BDR"
        ? BDR_ROW
        : (() => {
            const typeId = RV_CLASS_TO_TYPE[cls as Exclude<AssetClass, "BDR">];
            const t = PORTFOLIO_TYPE_BY_ID[typeId];
            return { name: t.label, taxRate: t.defaults.taxRate, volatility: t.defaults.volatility };
          })();
    assets.push({
      name: meta.name,
      weight: acc.value / totalBRL,
      expectedYield: clampYield(acc.yieldWeighted / acc.value),
      capitalGain: acc.gainWeighted / acc.value,
      taxRate: meta.taxRate,
      note: note(acc.labels),
      volatility: meta.volatility,
    });
  }

  for (const bucket of ["RF_PUBLICO", "RF_PRIVADO"] as const) {
    const acc = rfGroups[bucket];
    if (acc.value <= 0) continue;
    const t = PORTFOLIO_TYPE_BY_ID[bucket];
    assets.push({
      name: t.label,
      weight: acc.value / totalBRL,
      expectedYield: clampYield(acc.yieldWeighted / acc.value),
      capitalGain: 0,
      taxRate: t.defaults.taxRate,
      note: note(acc.labels),
      volatility: t.defaults.volatility,
    });
  }

  assets.sort((a, b) => b.weight - a.weight);

  // Re-normalize so the drawer's Σ=1±0.001 zod refine always holds.
  const sum = assets.reduce((s, a) => s + a.weight, 0);
  for (const a of assets) a.weight = a.weight / sum;

  return {
    portfolio: {
      capital: totalBRL,
      monthlyContribution: args.monthlyContribution,
      contributionInflationIndexed: args.contributionInflationIndexed,
      assets,
    },
    totalBRL,
    rvBRL,
    rfBRL,
    positionsCount,
    rfCount,
    skipped,
  };
}
