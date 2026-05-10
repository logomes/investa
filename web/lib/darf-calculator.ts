/**
 * Brazilian renda variável tax calculator (DARF mensal).
 *
 * Scope (v1):
 *   - Ações BR / ETF BR / BDR (15% IR sobre lucro líquido)
 *     - Isenção R$ 20k/mês de vendas em ações puras (ETF_BR + ACAO_*)
 *     - BDR e Stock US NÃO têm isenção R$ 20k — sempre tributados
 *   - FII (20% IR sobre lucro líquido, sem isenção)
 *   - Prejuízo acumulado compensável dentro do MESMO bucket
 *     (FII só compensa com FII; ações com ações)
 *
 * Out of scope:
 *   - Day trade vs swing trade distinction (assume tudo swing)
 *   - Stocks US com FX por trade (precisa data câmbio histórico — defer v2)
 *   - JCP/dividendo (isento PF)
 *
 * Cálculo:
 *   1. Walk trades chronologically per ticker; manter avgPrice rolling
 *      (método ponderado fiscal: avg só muda em compra; venda preserva avg)
 *   2. Cada venda gera lucro = (preço - avg) × qty
 *   3. Agrupar por mês × bucket (ações_isenta, ações_tributada, fii)
 *   4. Por mês:
 *      - Se vendas mês > limite isenção (R$20k pra ações isentas):
 *        lucro tributável = max(0, lucro - prejuízo_acumulado_bucket)
 *        IR = lucro_tributável × taxa_bucket
 *        Atualizar prejuízo_acumulado: max(0, prejuízo - lucro)
 *      - Se isenta: zera lucro/prejuízo do mês (não conta)
 */
import type { B3Trade } from "./b3-import";
import type { AssetPosition, AssetClass } from "./ativos-schema";

export type TaxBucket = "acoes_isenta" | "acoes_tributada" | "fii";

export type MonthlyBucketSummary = {
  bucket: TaxBucket;
  salesBRL: number;          // soma das vendas no mês
  numTrades: number;         // # de trades de venda
  realizedGain: number;      // lucro/(prejuízo) bruto
  isExempt: boolean;         // true quando vendas <= R$20k em ações isentas
  accumulatedLossIn: number; // prejuízo carry-forward do mês anterior
  taxableGain: number;       // lucro tributável após compensação
  irRate: number;            // 0.15 ou 0.20
  darfBRL: number;           // imposto a pagar (>= 0)
  accumulatedLossOut: number;// carry-forward pro próximo mês
};

export type MonthlyDarf = {
  month: string; // YYYY-MM
  buckets: MonthlyBucketSummary[];
  totalDarfBRL: number;
};

const ACOES_ISENTA_CLASSES: AssetClass[] = [
  "ACAO_BR_DIVIDENDO", "ACAO_BR_CRESCIMENTO", "ETF_BR",
];
const ACOES_TRIBUTADA_CLASSES: AssetClass[] = [
  "BDR", "STOCK_US", "REIT_US", "ETF_US",
];
const FII_CLASSES: AssetClass[] = ["FII_PAPEL", "FII_TIJOLO"];

function bucketFromClass(cls: AssetClass | null): TaxBucket | null {
  if (!cls) return null;
  if (FII_CLASSES.includes(cls)) return "fii";
  if (ACOES_ISENTA_CLASSES.includes(cls)) return "acoes_isenta";
  if (ACOES_TRIBUTADA_CLASSES.includes(cls)) return "acoes_tributada";
  return null;
}

const ISENCAO_LIMIT_ACOES = 20_000;
const IR_RATE = { acoes_isenta: 0.15, acoes_tributada: 0.15, fii: 0.20 } as const;

type RollingPosition = { qty: number; avgPrice: number };
type SaleRecord = {
  date: string;
  ticker: string;
  bucket: TaxBucket;
  salesBRL: number;
  realizedGain: number;
};

function monthOf(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

/**
 * Walk all trades chronologically, group sells per (month, bucket), and apply
 * the prejuízo carry-forward and isenção rules.
 *
 * `tickerToClass`: lookup function — caller provides via positions list.
 */
export function computeMonthlyDarf(
  trades: readonly B3Trade[],
  tickerToClass: (ticker: string) => AssetClass | null,
): MonthlyDarf[] {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const rolling = new Map<string, RollingPosition>();
  const sales: SaleRecord[] = [];

  for (const t of sorted) {
    const cur = rolling.get(t.ticker) ?? { qty: 0, avgPrice: 0 };
    if (t.side === "buy") {
      const newQty = cur.qty + t.quantity;
      const newAvg = newQty > 0 ? (cur.qty * cur.avgPrice + t.quantity * t.price) / newQty : 0;
      rolling.set(t.ticker, { qty: newQty, avgPrice: newAvg });
    } else {
      // sell
      const cls = tickerToClass(t.ticker);
      const bucket = bucketFromClass(cls);
      if (!bucket) {
        // Unknown classification — skip silently rather than mis-classify.
        cur.qty -= t.quantity;
        if (cur.qty <= 0) { cur.qty = 0; cur.avgPrice = 0; }
        rolling.set(t.ticker, cur);
        continue;
      }
      const salesBRL = t.quantity * t.price;
      const gain = (t.price - cur.avgPrice) * t.quantity;
      sales.push({ date: t.date, ticker: t.ticker, bucket, salesBRL, realizedGain: gain });
      cur.qty -= t.quantity;
      if (cur.qty <= 0) { cur.qty = 0; cur.avgPrice = 0; }
      rolling.set(t.ticker, cur);
    }
  }

  // Group sales by (month, bucket)
  const grouped = new Map<string, Map<TaxBucket, { salesBRL: number; gain: number; count: number }>>();
  for (const s of sales) {
    const m = monthOf(s.date);
    const byBucket = grouped.get(m) ?? new Map();
    const cur = byBucket.get(s.bucket) ?? { salesBRL: 0, gain: 0, count: 0 };
    cur.salesBRL += s.salesBRL;
    cur.gain += s.realizedGain;
    cur.count += 1;
    byBucket.set(s.bucket, cur);
    grouped.set(m, byBucket);
  }

  // Walk months chronologically applying carry-forward per bucket
  const months = Array.from(grouped.keys()).sort();
  const carry: Record<TaxBucket, number> = { acoes_isenta: 0, acoes_tributada: 0, fii: 0 };
  const result: MonthlyDarf[] = [];

  for (const month of months) {
    const byBucket = grouped.get(month)!;
    const buckets: MonthlyBucketSummary[] = [];
    let totalDarf = 0;

    for (const bucket of ["acoes_isenta", "acoes_tributada", "fii"] as TaxBucket[]) {
      const data = byBucket.get(bucket);
      if (!data || data.count === 0) continue;

      const isExempt =
        bucket === "acoes_isenta" && data.salesBRL <= ISENCAO_LIMIT_ACOES;

      let taxableGain = 0;
      let darf = 0;
      let lossOut = carry[bucket];

      if (isExempt) {
        // Sale exempt — no tax due. Loss carries forward unchanged.
        // (Operações isentas não geram nem usam prejuízo a compensar.)
      } else {
        if (data.gain > 0) {
          taxableGain = Math.max(0, data.gain - carry[bucket]);
          darf = taxableGain * IR_RATE[bucket];
          lossOut = Math.max(0, carry[bucket] - data.gain);
        } else {
          // Prejuízo: aumenta o pool
          lossOut = carry[bucket] + Math.abs(data.gain);
        }
      }

      buckets.push({
        bucket,
        salesBRL: data.salesBRL,
        numTrades: data.count,
        realizedGain: data.gain,
        isExempt,
        accumulatedLossIn: carry[bucket],
        taxableGain,
        irRate: IR_RATE[bucket],
        darfBRL: darf,
        accumulatedLossOut: lossOut,
      });

      totalDarf += darf;
      carry[bucket] = lossOut;
    }

    if (buckets.length > 0) result.push({ month, buckets, totalDarfBRL: totalDarf });
  }

  return result;
}

/**
 * Helper to build a tickerToClass lookup from current positions.
 * Falls back to null when the ticker isn't in the position list (sold all).
 */
export function tickerToClassMap(positions: readonly AssetPosition[]): (ticker: string) => AssetClass | null {
  const map = new Map<string, AssetClass>();
  for (const p of positions) map.set(p.ticker.toUpperCase(), p.assetClass);
  return (ticker) => map.get(ticker.toUpperCase()) ?? null;
}
