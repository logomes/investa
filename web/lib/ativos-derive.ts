import type { AssetPosition, AssetClass } from "./ativos-schema";
import { ASSET_CLASS_META } from "./ativos-schema";
import type { MacroOut } from "./api-types";

export function positionValueBRL(p: AssetPosition, macro: MacroOut): number {
  const localValue = p.quantity * p.avgPrice;
  return p.currency === "USD" ? localValue * macro.usdBrl : localValue;
}

/**
 * Unrealized gain since the avgPrice was paid. Returns null when we don't
 * have a current quote — the caller should render an em-dash in that case.
 *
 * For US assets, the BRL gain is computed in native currency first then
 * converted with the live FX, so the rendered value reflects asset-level
 * P&L, not USD/BRL drift on the cost basis.
 */
export type UnrealizedGain = { gainBRL: number; gainPct: number };

export function unrealizedGain(p: AssetPosition, macro: MacroOut): UnrealizedGain | null {
  if (!p.currentPrice || !Number.isFinite(p.currentPrice)) return null;
  const cost = p.quantity * p.avgPrice;
  const market = p.quantity * p.currentPrice;
  const fx = p.currency === "USD" ? macro.usdBrl : 1;
  const gainBRL = (market - cost) * fx;
  const gainPct = cost > 0 ? (market - cost) / cost : 0;
  return { gainBRL, gainPct };
}

export type AtivosKpis = {
  totalAllocated: number;
  blendedYield: number;
  blendedCapitalGain: number;
  totalReturn: number;
};

export function ativosKpis(positions: AssetPosition[], macro: MacroOut): AtivosKpis {
  if (positions.length === 0) {
    return { totalAllocated: 0, blendedYield: 0, blendedCapitalGain: 0, totalReturn: 0 };
  }
  const valuesBRL = positions.map((p) => positionValueBRL(p, macro));
  const totalAllocated = valuesBRL.reduce((s, v) => s + v, 0);
  if (totalAllocated === 0) {
    return { totalAllocated: 0, blendedYield: 0, blendedCapitalGain: 0, totalReturn: 0 };
  }

  let weightedYieldNet = 0;
  let weightedCapGain = 0;
  // Convention: ASSET_CLASS_META.taxRate is applied uniformly as a haircut on
  // expected yield. For ETF_BR / BDR the metadata note says "15% sobre ganho",
  // but we model it on yield for simplicity (yield is small for those classes).
  // Capital gain is reported gross. See FUTURE_IMPROVEMENTS for refinement.
  positions.forEach((p, i) => {
    const w = valuesBRL[i] / totalAllocated;
    const taxRate = ASSET_CLASS_META[p.assetClass].taxRate;
    weightedYieldNet += w * p.expectedYield * (1 - taxRate);
    weightedCapGain += w * p.capitalGain;
  });

  return {
    totalAllocated,
    blendedYield: weightedYieldNet,
    blendedCapitalGain: weightedCapGain,
    totalReturn: weightedYieldNet + weightedCapGain,
  };
}

export type AssetClassGroup = {
  assetClass: AssetClass;
  label: string;
  color: string;
  positions: number;
  totalBRL: number;
  weight: number;
};

export function byAssetClass(positions: AssetPosition[], macro: MacroOut): AssetClassGroup[] {
  const valuesBRL = positions.map((p) => positionValueBRL(p, macro));
  const total = valuesBRL.reduce((s, v) => s + v, 0);
  const grouped = new Map<AssetClass, { count: number; sum: number }>();
  positions.forEach((p, i) => {
    const cur = grouped.get(p.assetClass) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += valuesBRL[i];
    grouped.set(p.assetClass, cur);
  });
  return Array.from(grouped.entries())
    .map(([cls, { count, sum }]) => ({
      assetClass: cls,
      label: ASSET_CLASS_META[cls].label,
      color: ASSET_CLASS_META[cls].color,
      positions: count,
      totalBRL: sum,
      weight: total > 0 ? sum / total : 0,
    }))
    .sort((a, b) => b.totalBRL - a.totalBRL);
}

export type MarketSplit = {
  br: { totalBRL: number; weight: number; positions: number };
  us: { totalBRL: number; weight: number; positions: number };
};

export function byMarket(positions: AssetPosition[], macro: MacroOut): MarketSplit {
  const split = { br: { totalBRL: 0, positions: 0 }, us: { totalBRL: 0, positions: 0 } };
  positions.forEach((p) => {
    const v = positionValueBRL(p, macro);
    const market = ASSET_CLASS_META[p.assetClass].market;
    if (market === "BR") {
      split.br.totalBRL += v;
      split.br.positions += 1;
    } else {
      split.us.totalBRL += v;
      split.us.positions += 1;
    }
  });
  const total = split.br.totalBRL + split.us.totalBRL;
  return {
    br: { ...split.br, weight: total > 0 ? split.br.totalBRL / total : 0 },
    us: { ...split.us, weight: total > 0 ? split.us.totalBRL / total : 0 },
  };
}
