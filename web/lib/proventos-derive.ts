import type { AssetPosition } from "./ativos-schema";
import type { MacroOut } from "./api-types";
import type { B3PaidProvent, B3ScheduledEvent } from "./b3-import";
import { positionValueBRL } from "./ativos-derive";

export type ProventosKpis = {
  paid12m: number;          // total recebido nos últimos 12m (R$)
  scheduledNext: number;     // total agendado no futuro (R$) — Eventos export
  dyRealized: number;        // paid12m / patrimônio atual (decimal)
  dyExpectedBlended: number; // ponderado das positions (decimal, líquido de IR de origem)
  nextPayment: { ticker: string; date: string; netValue: number } | null;
};

export type MonthlyProventos = {
  month: string;       // YYYY-MM
  paid: number;
  scheduled: number;
};

export type ProventosByTicker = {
  ticker: string;
  assetClass: AssetPosition["assetClass"] | "UNKNOWN";
  paid12m: number;
  scheduled: number;
  positionValueBRL: number;       // 0 se não está mais em positions
  dyRealized: number | null;      // paid12m / valueBRL (decimal) — null sem position
  dyExpected: number | null;      // decimal — null sem position
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function proventosKpis(
  paid: readonly B3PaidProvent[],
  scheduled: readonly B3ScheduledEvent[],
  positions: readonly AssetPosition[],
  macro: MacroOut,
  now: Date = new Date(),
): ProventosKpis {
  // 12-month window: anything paid in the last 12 calendar months counts.
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const paid12m = paid
    .filter((p) => p.paidDate >= cutoffIso && p.paidDate <= now.toISOString().slice(0, 10))
    .reduce((s, p) => s + p.netValue, 0);

  const todayIso = now.toISOString().slice(0, 10);
  const upcoming = scheduled.filter((e) => e.paymentDate >= todayIso);
  const scheduledNext = upcoming.reduce((s, e) => s + e.netValue, 0);

  const totalValue = positions.reduce((s, p) => s + positionValueBRL(p, macro), 0);
  const dyRealized = totalValue > 0 ? paid12m / totalValue : 0;

  // Expected DY: weighted by patrimônio, líquido do IR de origem (taxRate)
  // só para dividendos US — para BR (FII isento, ações isentas) taxRate=0.
  // Reaproveita os defaults do ASSET_CLASS_META já presente nas positions.
  let weightedYield = 0;
  for (const p of positions) {
    if (totalValue <= 0) break;
    const w = positionValueBRL(p, macro) / totalValue;
    weightedYield += w * p.expectedYield;
  }

  // Próximo provento (entre scheduled futuros, o mais próximo).
  const nextSorted = upcoming.slice().sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const next = nextSorted[0];
  const nextPayment = next ? { ticker: next.ticker, date: next.paymentDate, netValue: next.netValue } : null;

  return { paid12m, scheduledNext, dyRealized, dyExpectedBlended: weightedYield, nextPayment };
}

/**
 * Monthly series for the chart: pastMonths of paid history ending at the
 * current month, plus futureMonths of scheduled payments forward.
 */
export function proventosMonthly(
  paid: readonly B3PaidProvent[],
  scheduled: readonly B3ScheduledEvent[],
  pastMonths: number = 24,
  futureMonths: number = 3,
  now: Date = new Date(),
): MonthlyProventos[] {
  const start = todayMonth(now);
  const months: string[] = [];
  for (let i = pastMonths - 1; i >= 0; i--) months.push(addMonths(start, -i));
  for (let i = 1; i <= futureMonths; i++) months.push(addMonths(start, i));

  const paidByMonth = new Map<string, number>();
  for (const p of paid) {
    const m = monthKey(p.paidDate);
    paidByMonth.set(m, (paidByMonth.get(m) ?? 0) + p.netValue);
  }
  const scheduledByMonth = new Map<string, number>();
  for (const e of scheduled) {
    const m = monthKey(e.paymentDate);
    scheduledByMonth.set(m, (scheduledByMonth.get(m) ?? 0) + e.netValue);
  }

  return months.map((m) => ({
    month: m,
    paid: paidByMonth.get(m) ?? 0,
    scheduled: scheduledByMonth.get(m) ?? 0,
  }));
}

export function proventosByTicker(
  paid: readonly B3PaidProvent[],
  scheduled: readonly B3ScheduledEvent[],
  positions: readonly AssetPosition[],
  macro: MacroOut,
  now: Date = new Date(),
): ProventosByTicker[] {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const todayIso = now.toISOString().slice(0, 10);

  const paidByTicker = new Map<string, number>();
  for (const p of paid) {
    if (p.paidDate < cutoffIso || p.paidDate > todayIso) continue;
    const t = p.ticker.toUpperCase();
    paidByTicker.set(t, (paidByTicker.get(t) ?? 0) + p.netValue);
  }
  const scheduledByTicker = new Map<string, number>();
  for (const e of scheduled) {
    if (e.paymentDate < todayIso) continue;
    const t = e.ticker.toUpperCase();
    scheduledByTicker.set(t, (scheduledByTicker.get(t) ?? 0) + e.netValue);
  }
  const posByTicker = new Map<string, AssetPosition>();
  for (const p of positions) posByTicker.set(p.ticker.toUpperCase(), p);

  const tickers = new Set<string>([
    ...Array.from(paidByTicker.keys()),
    ...Array.from(scheduledByTicker.keys()),
  ]);

  const rows: ProventosByTicker[] = [];
  for (const ticker of Array.from(tickers)) {
    const pos = posByTicker.get(ticker);
    const valueBRL = pos ? positionValueBRL(pos, macro) : 0;
    const paid12m = paidByTicker.get(ticker) ?? 0;
    const scheduledAmt = scheduledByTicker.get(ticker) ?? 0;
    rows.push({
      ticker,
      assetClass: pos?.assetClass ?? "UNKNOWN",
      paid12m,
      scheduled: scheduledAmt,
      positionValueBRL: valueBRL,
      dyRealized: valueBRL > 0 ? paid12m / valueBRL : null,
      dyExpected: pos ? pos.expectedYield : null,
    });
  }

  return rows.sort((a, b) => (b.paid12m + b.scheduled) - (a.paid12m + a.scheduled));
}
