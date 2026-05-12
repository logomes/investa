import type { AssetPosition } from "./ativos-schema";
import type { MacroOut } from "./api-types";
import type { B3PaidProvent, B3ScheduledEvent, B3Trade } from "./b3-import";
import { unrealizedGain, type UnrealizedGain } from "./ativos-derive";
import { assetMarketValueBRL } from "./patrimony-snapshot";

export type AssetDetail = {
  position: AssetPosition | null;
  marketValueBRL: number;
  unrealized: UnrealizedGain | null;
  trades: B3Trade[];
  paid: B3PaidProvent[];
  scheduled: B3ScheduledEvent[];
  paid12m: number;
  paidAllTime: number;
  scheduledTotal: number;
  dyRealized12m: number | null;       // paid12m / marketValue (decimal) — null sem position
  dyExpected: number | null;          // copy of position.expectedYield
  totalInvested: number;              // soma dos buys (qty × price) em moeda nativa
  totalWithdrawn: number;             // soma dos sells (qty × price) em moeda nativa
  netInvested: number;                // totalInvested - totalWithdrawn (custo realizado)
  totalReturn: number;                // marketValueBRL + paidAllTime - netInvested_em_BRL
  roiTotal: number | null;            // totalReturn / netInvested_em_BRL — null sem invested
};

function withinLast12Months(iso: string, now: Date): boolean {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const todayIso = now.toISOString().slice(0, 10);
  return iso >= cutoffIso && iso <= todayIso;
}

/**
 * Aggregate everything we know about a single ticker into a detail bundle
 * for the per-ticker page. All inputs are pre-filtered globals; this fn
 * picks the matching slice. Read-only — no mutation of inputs.
 */
export function assetDetail(
  ticker: string,
  positions: readonly AssetPosition[],
  trades: readonly B3Trade[],
  paid: readonly B3PaidProvent[],
  scheduled: readonly B3ScheduledEvent[],
  macro: MacroOut,
  now: Date = new Date(),
): AssetDetail {
  const t = ticker.trim().toUpperCase();
  const position = positions.find((p) => p.ticker.toUpperCase() === t) ?? null;

  const tradesForTicker = trades
    .filter((x) => x.ticker.toUpperCase() === t)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const paidForTicker = paid
    .filter((x) => x.ticker.toUpperCase() === t)
    .slice()
    .sort((a, b) => a.paidDate.localeCompare(b.paidDate));

  const todayIso = now.toISOString().slice(0, 10);
  const scheduledForTicker = scheduled
    .filter((x) => x.ticker.toUpperCase() === t && x.paymentDate >= todayIso)
    .slice()
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  const marketValueBRL = position ? assetMarketValueBRL(position, macro) : 0;
  const unrealized = position ? unrealizedGain(position, macro) : null;

  const paid12m = paidForTicker
    .filter((p) => withinLast12Months(p.paidDate, now))
    .reduce((s, p) => s + p.netValue, 0);
  const paidAllTime = paidForTicker.reduce((s, p) => s + p.netValue, 0);
  const scheduledTotal = scheduledForTicker.reduce((s, e) => s + e.netValue, 0);

  const dyRealized12m = marketValueBRL > 0 ? paid12m / marketValueBRL : null;
  const dyExpected = position ? position.expectedYield : null;

  // Trade totals in native currency (avgPrice is also native). USD positions
  // need FX to compare to paid (which we assume is in BRL — B3 provents).
  const totalInvested = tradesForTicker
    .filter((x) => x.side === "buy")
    .reduce((s, x) => s + x.quantity * x.price, 0);
  const totalWithdrawn = tradesForTicker
    .filter((x) => x.side === "sell")
    .reduce((s, x) => s + x.quantity * x.price, 0);
  const netInvested = totalInvested - totalWithdrawn;
  const fx = position?.currency === "USD" ? macro.usdBrl : 1;
  const netInvestedBRL = netInvested * fx;
  const totalReturn = marketValueBRL + paidAllTime - netInvestedBRL;
  const roiTotal = netInvestedBRL > 0 ? totalReturn / netInvestedBRL : null;

  return {
    position,
    marketValueBRL,
    unrealized,
    trades: tradesForTicker,
    paid: paidForTicker,
    scheduled: scheduledForTicker,
    paid12m,
    paidAllTime,
    scheduledTotal,
    dyRealized12m,
    dyExpected,
    totalInvested,
    totalWithdrawn,
    netInvested,
    totalReturn,
    roiTotal,
  };
}
