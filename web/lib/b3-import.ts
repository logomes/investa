/**
 * Parser for the "Investidor B3 → Minha Carteira → Investimentos → Posição" export.
 *
 * Format (CSV/XLSX with same column structure):
 *   Produto, Instituição, Conta, Código de Negociação, CNPJ, ISIN, Tipo,
 *   Escriturador, Quantidade, Quantidade Disponível, Quantidade Indisponível,
 *   Motivo, Preço de Fechamento, Valor Atualizado
 *
 * The same ticker may appear multiple times when held across brokers — rows
 * are aggregated by ticker (sum quantities, take closing price as the unit
 * cost reference). The footer rows ("Total" + sum) are skipped.
 *
 * Caveat: this report does not include cost basis. avgPrice is set to the
 * closing price; users who want unrealized-gain tracking should also import
 * Extratos → Negociação (separate scope, deferred).
 */
import { inferAssetClass } from "./ativos-classify";
import type { AssetClass } from "./ativos-schema";

export type ParsedB3Position = {
  ticker: string;
  assetClass: AssetClass;
  currency: "BRL";
  quantity: number;
  closingPrice: number;
  asOf: string; // ISO 8601
};

export type B3Trade = {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  date: string; // ISO YYYY-MM-DD
};

export type B3ImportError = { row: number; message: string };
export type B3ImportResult = {
  positions: ParsedB3Position[];
  brokers: string[]; // distinct brokers seen in the input — surfaced for the confirm dialog
  errors: B3ImportError[];
};
export type B3MovementsResult = {
  trades: B3Trade[];
  errors: B3ImportError[];
  earliestDate: string | null;
  latestDate: string | null;
};

export type B3ScheduledEvent = {
  ticker: string;
  type: string; // "RENDIMENTO" / "DIVIDENDO" / "JUROS SOBRE CAPITAL PRÓPRIO" / "Reembolso - ..."
  paymentDate: string; // ISO YYYY-MM-DD
  quantity: number;
  unitPrice: number;
  netValue: number;
};

export type B3EventsResult = {
  events: B3ScheduledEvent[];
  errors: B3ImportError[];
};

// Historical income that already settled (Movimentação shows them with
// types Rendimento / Dividendo / Juros Sobre Capital Próprio / Reembolso).
// Unlike B3ScheduledEvent (forward-looking, from Eventos export), these are
// past payments and carry the cash that hit the account.
export type B3PaidProvent = {
  ticker: string;
  type: string;       // raw type as B3 reports it
  paidDate: string;   // ISO YYYY-MM-DD
  netValue: number;   // in BRL
};

export type B3PaidProventsResult = {
  provents: B3PaidProvent[];
  errors: B3ImportError[];
};

export function isB3PositionHeader(row: readonly (string | null | undefined)[]): boolean {
  if (!row) return false;
  // Discriminator columns are enough — ações sheets have 14 cols, ETF/FII sheets 13.
  return row.includes("Código de Negociação") && row.includes("Quantidade") && row.includes("Preço de Fechamento");
}

function parseBrNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s === "-") return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function refineClassFromTipo(ticker: string, tipo: string | null | undefined): AssetClass {
  const t = (tipo ?? "").trim().toUpperCase();
  // ON / PN / UNIT are share classes for ações — pattern-based inference works.
  // FII / ETF tipos in B3 exports normally read literally — handle them explicitly.
  if (t === "FII") return "FII_PAPEL";
  if (t === "ETF") return "ETF_BR";
  return inferAssetClass(ticker) ?? "ACAO_BR_DIVIDENDO";
}

// Sheet name on the multi-tab Investidor B3 XLSX hints the asset class
// for that whole tab — overrides Tipo when present.
function classFromSheetName(name: string): AssetClass | null {
  switch (name.trim()) {
    case "ETF": return "ETF_BR";
    case "Fundo de Investimento": return "FII_PAPEL";
    case "Acoes": return null; // delegate to refineClassFromTipo (ON/PN/UNIT)
    default: return null;
  }
}

/**
 * Parse rows from a B3 position export. `rows` is a 2D array (header + data),
 * already converted from CSV or XLSX upstream. `sheetName` is used to derive
 * the asset class when set (XLSX exports group by sheet: "Acoes", "ETF",
 * "Fundo de Investimento").
 */
export function parseB3Position(rows: readonly (readonly (string | number | null | undefined)[])[], sheetName?: string): B3ImportResult {
  if (rows.length === 0) {
    return { positions: [], brokers: [], errors: [{ row: 0, message: "arquivo vazio" }] };
  }

  const header = rows[0].map((c) => (typeof c === "string" ? c.trim() : ""));
  if (!isB3PositionHeader(header)) {
    return { positions: [], brokers: [], errors: [{ row: 0, message: "cabeçalho não corresponde ao relatório B3 Posição" }] };
  }

  const colIdx = (name: string) => header.indexOf(name);
  const TICKER = colIdx("Código de Negociação");
  const TIPO = colIdx("Tipo");
  const QTY = colIdx("Quantidade");
  const PRICE = colIdx("Preço de Fechamento");
  const BROKER = colIdx("Instituição");

  // ticker → accumulator
  const agg = new Map<string, { quantity: number; closingPrice: number; tipo: string }>();
  const brokers = new Set<string>();
  const errors: B3ImportError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ticker = typeof row[TICKER] === "string" ? (row[TICKER] as string).trim().toUpperCase() : "";
    if (!ticker) continue; // skip footer / blank rows
    if (ticker === "TOTAL" || ticker === "TOTAIS") continue; // defensive: some reports localize the footer cell

    const quantity = parseBrNumber(row[QTY]);
    const price = parseBrNumber(row[PRICE]);
    if (quantity === null || price === null) {
      errors.push({ row: i + 1, message: `linha ${i + 1}: quantidade/preço inválidos para ${ticker}` });
      continue;
    }

    const broker = typeof row[BROKER] === "string" ? (row[BROKER] as string).trim() : "";
    if (broker) brokers.add(broker);

    const tipo = typeof row[TIPO] === "string" ? (row[TIPO] as string).trim() : "";

    const cur = agg.get(ticker);
    if (cur) {
      cur.quantity += quantity;
      // closingPrice should be identical across rows for the same ticker on
      // the same export — keep the first non-zero one.
      if (!cur.closingPrice && price) cur.closingPrice = price;
    } else {
      agg.set(ticker, { quantity, closingPrice: price, tipo });
    }
  }

  const asOf = new Date().toISOString();
  const sheetHint = sheetName ? classFromSheetName(sheetName) : null;
  const positions: ParsedB3Position[] = Array.from(agg.entries()).map(([ticker, v]) => ({
    ticker,
    assetClass: sheetHint ?? refineClassFromTipo(ticker, v.tipo),
    currency: "BRL",
    quantity: v.quantity,
    closingPrice: v.closingPrice,
    asOf,
  }));

  return { positions, brokers: Array.from(brokers).sort(), errors };
}

// ---------- Movements export ("Extratos → Movimentação") ----------

export function isB3MovementsHeader(row: readonly (string | null | undefined)[]): boolean {
  if (!row || row.length < 6) return false;
  return row.includes("Entrada/Saída") && row.includes("Movimentação") && row.includes("Preço unitário");
}

function parseBrDate(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function tickerFromProduto(produto: string): string | null {
  // "PETR4 - PETROLEO BRASILEIRO..." → "PETR4"; bare "PETR4" also accepted.
  const trimmed = produto.trim();
  const withDash = trimmed.match(/^([A-Z0-9]{2,6})\s*-/i);
  if (withDash) return withDash[1].toUpperCase();
  const bare = trimmed.match(/^([A-Z0-9]{2,6})$/i);
  return bare ? bare[1].toUpperCase() : null;
}

export function parseB3Movements(rows: readonly (readonly (string | number | null | undefined)[])[]): B3MovementsResult {
  if (rows.length === 0) {
    return { trades: [], errors: [{ row: 0, message: "arquivo vazio" }], earliestDate: null, latestDate: null };
  }
  const header = rows[0].map((c) => (typeof c === "string" ? c.trim() : ""));
  if (!isB3MovementsHeader(header)) {
    return { trades: [], errors: [{ row: 0, message: "cabeçalho não corresponde ao relatório B3 Movimentação" }], earliestDate: null, latestDate: null };
  }

  const colIdx = (name: string) => header.indexOf(name);
  const SIDE = colIdx("Entrada/Saída");
  const DATE = colIdx("Data");
  const TYPE = colIdx("Movimentação");
  const PRODUTO = colIdx("Produto");
  const QTY = colIdx("Quantidade");
  const PRICE = colIdx("Preço unitário");

  const trades: B3Trade[] = [];
  const errors: B3ImportError[] = [];
  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const moveType = typeof row[TYPE] === "string" ? (row[TYPE] as string).trim() : "";
    // Only "Transferência - Liquidação" with a positive price represents a settled buy/sell.
    // Other types (Rendimento, JCP, Reembolso, Empréstimo, Transferência) don't change cost basis.
    if (moveType !== "Transferência - Liquidação") continue;

    const sideRaw = typeof row[SIDE] === "string" ? (row[SIDE] as string).trim() : "";
    const side: "buy" | "sell" | null = sideRaw === "Credito" ? "buy" : sideRaw === "Debito" ? "sell" : null;
    if (!side) continue;

    const produto = typeof row[PRODUTO] === "string" ? (row[PRODUTO] as string) : "";
    const ticker = tickerFromProduto(produto);
    if (!ticker) continue;

    const dateRaw = typeof row[DATE] === "string" ? (row[DATE] as string) : "";
    const date = parseBrDate(dateRaw);
    if (!date) {
      errors.push({ row: i + 1, message: `linha ${i + 1}: data inválida '${dateRaw}'` });
      continue;
    }

    const qty = parseBrNumber(row[QTY]);
    const price = parseBrNumber(row[PRICE]);
    if (qty === null || qty <= 0 || price === null || price <= 0) {
      // Liquidações sem preço (transferências de custódia entre brokers) entram como
      // "Transferência - Liquidação" mas com preço "-" — pular silenciosamente.
      continue;
    }

    trades.push({ ticker, side, quantity: qty, price, date });

    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!latestDate || date > latestDate) latestDate = date;
  }

  return { trades, errors, earliestDate, latestDate };
}

// ---------- Paid provents from Movimentação ----------
// Same header/file as parseB3Movements, but here we extract rows that
// represent income paid out (Rendimento/Dividendo/JCP/Reembolso) instead
// of trades. This gives us a historical view that complements the
// forward-looking Eventos export.

const PROVENT_TYPES = ["Rendimento", "Dividendo", "Juros Sobre Capital Próprio"] as const;

function isProventType(t: string): boolean {
  const upper = t.toUpperCase();
  if (PROVENT_TYPES.some((p) => upper === p.toUpperCase())) return true;
  // "Reembolso - ..." also represents cash that hit the account.
  return upper.startsWith("REEMBOLSO");
}

export function parseB3PaidProvents(rows: readonly (readonly (string | number | null | undefined)[])[]): B3PaidProventsResult {
  if (rows.length === 0) {
    return { provents: [], errors: [{ row: 0, message: "arquivo vazio" }] };
  }
  const header = rows[0].map((c) => (typeof c === "string" ? c.trim() : ""));
  if (!isB3MovementsHeader(header)) {
    return { provents: [], errors: [{ row: 0, message: "cabeçalho não corresponde ao relatório B3 Movimentação" }] };
  }

  const colIdx = (name: string) => header.indexOf(name);
  const DATE = colIdx("Data");
  const TYPE = colIdx("Movimentação");
  const PRODUTO = colIdx("Produto");
  const QTY = colIdx("Quantidade");
  const PRICE = colIdx("Preço unitário");
  // "Valor da Operação" / "Valor da operação" — fall back to qty × price
  // when the column is missing or empty.
  const VALOR = header.findIndex((h) => /^valor\s+da\s+opera/i.test(h));

  const provents: B3PaidProvent[] = [];
  const errors: B3ImportError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const moveType = typeof row[TYPE] === "string" ? (row[TYPE] as string).trim() : "";
    if (!isProventType(moveType)) continue;

    const produto = typeof row[PRODUTO] === "string" ? (row[PRODUTO] as string) : "";
    const ticker = tickerFromProduto(produto);
    if (!ticker) continue;

    const dateRaw = typeof row[DATE] === "string" ? (row[DATE] as string) : "";
    const paidDate = parseBrDate(dateRaw);
    if (!paidDate) {
      errors.push({ row: i + 1, message: `linha ${i + 1}: data inválida '${dateRaw}'` });
      continue;
    }

    const direct = VALOR >= 0 ? parseBrNumber(row[VALOR]) : null;
    let netValue = direct;
    if (netValue === null || netValue <= 0) {
      const qty = parseBrNumber(row[QTY]);
      const price = parseBrNumber(row[PRICE]);
      if (qty !== null && price !== null && qty > 0 && price > 0) netValue = qty * price;
    }
    if (netValue === null || netValue <= 0) continue;

    provents.push({ ticker, type: moveType, paidDate, netValue });
  }

  return { provents, errors };
}

// ---------- Negociação export ("Extratos → Negociação") ----------
// Cleaner trade-only history: only Compra/Venda rows, no provent noise.
// Tickers may carry an `F` suffix on the Mercado Fracionário (e.g. BBDC3F).
// We normalize to the integer-market ticker (BBDC3) so the same asset
// aggregates across whole-lot and fractional-lot trades.

const NEGOCIACAO_HEADERS = ["Data do Negócio", "Tipo de Movimentação", "Código de Negociação", "Quantidade", "Preço"];

export function isB3NegociacaoHeader(row: readonly (string | null | undefined)[]): boolean {
  if (!row) return false;
  return NEGOCIACAO_HEADERS.every((h) => row.includes(h));
}

function stripFractionalSuffix(ticker: string): string {
  // "BBDC3F" → "BBDC3"; "TAEE11F" → "TAEE11"; "AAPL34" → "AAPL34" (no F)
  const m = ticker.match(/^([A-Z0-9]*\d)F$/);
  return m ? m[1] : ticker;
}

export function parseB3Negociacao(rows: readonly (readonly (string | number | null | undefined)[])[]): B3MovementsResult {
  if (rows.length === 0) {
    return { trades: [], errors: [{ row: 0, message: "arquivo vazio" }], earliestDate: null, latestDate: null };
  }
  const header = rows[0].map((c) => (typeof c === "string" ? c.trim() : ""));
  if (!isB3NegociacaoHeader(header)) {
    return { trades: [], errors: [{ row: 0, message: "cabeçalho não corresponde ao relatório B3 Negociação" }], earliestDate: null, latestDate: null };
  }

  const colIdx = (name: string) => header.indexOf(name);
  const DATE = colIdx("Data do Negócio");
  const TYPE = colIdx("Tipo de Movimentação");
  const TICKER = colIdx("Código de Negociação");
  const QTY = colIdx("Quantidade");
  const PRICE = colIdx("Preço");

  const trades: B3Trade[] = [];
  const errors: B3ImportError[] = [];
  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const tipoRaw = typeof row[TYPE] === "string" ? (row[TYPE] as string).trim() : "";
    const side: "buy" | "sell" | null = tipoRaw === "Compra" ? "buy" : tipoRaw === "Venda" ? "sell" : null;
    if (!side) continue;

    const tickerRaw = typeof row[TICKER] === "string" ? (row[TICKER] as string).trim().toUpperCase() : "";
    if (!tickerRaw) continue;
    const ticker = stripFractionalSuffix(tickerRaw);

    const dateRaw = typeof row[DATE] === "string" ? (row[DATE] as string) : "";
    const date = parseBrDate(dateRaw);
    if (!date) {
      errors.push({ row: i + 1, message: `linha ${i + 1}: data inválida '${dateRaw}'` });
      continue;
    }

    const qty = parseBrNumber(row[QTY]);
    const price = parseBrNumber(row[PRICE]);
    if (qty === null || qty <= 0 || price === null || price <= 0) continue;

    trades.push({ ticker, side, quantity: qty, price, date });

    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!latestDate || date > latestDate) latestDate = date;
  }

  return { trades, errors, earliestDate, latestDate };
}

// ---------- Events export ("Extratos → Eventos") ----------
// These are *scheduled future* income payments (RENDIMENTO/DIVIDENDO/JCP).
// They do not affect quantity or cost basis — they are forward-looking yield.

export function isB3EventsHeader(row: readonly (string | null | undefined)[]): boolean {
  if (!row) return false;
  return row.includes("Tipo de Evento") && row.includes("Previsão de pagamento") && row.includes("Valor líquido");
}

export function parseB3Events(rows: readonly (readonly (string | number | null | undefined)[])[]): B3EventsResult {
  if (rows.length === 0) {
    return { events: [], errors: [{ row: 0, message: "arquivo vazio" }] };
  }
  const header = rows[0].map((c) => (typeof c === "string" ? c.trim() : ""));
  if (!isB3EventsHeader(header)) {
    return { events: [], errors: [{ row: 0, message: "cabeçalho não corresponde ao relatório B3 Eventos" }] };
  }

  const colIdx = (name: string) => header.indexOf(name);
  const PRODUTO = colIdx("Produto");
  const TIPO_EVENTO = colIdx("Tipo de Evento");
  const PREVISAO = colIdx("Previsão de pagamento");
  const QTY = colIdx("Quantidade");
  const PRICE = colIdx("Preço unitário");
  const NET = colIdx("Valor líquido");

  const events: B3ScheduledEvent[] = [];
  const errors: B3ImportError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const produto = typeof row[PRODUTO] === "string" ? (row[PRODUTO] as string) : "";
    const ticker = tickerFromProduto(produto);
    if (!ticker) continue;

    const type = typeof row[TIPO_EVENTO] === "string" ? (row[TIPO_EVENTO] as string).trim() : "";
    if (!type) continue;

    const dateRaw = typeof row[PREVISAO] === "string" ? (row[PREVISAO] as string) : "";
    const paymentDate = parseBrDate(dateRaw);
    if (!paymentDate) {
      errors.push({ row: i + 1, message: `linha ${i + 1}: data de pagamento inválida '${dateRaw}'` });
      continue;
    }

    const qty = parseBrNumber(row[QTY]) ?? 0;
    const unitPrice = parseBrNumber(row[PRICE]) ?? 0;
    const netValue = parseBrNumber(row[NET]) ?? 0;

    events.push({ ticker, type, paymentDate, quantity: qty, unitPrice, netValue });
  }

  return { events, errors };
}

/**
 * Sum scheduled net income per ticker.
 */
export function aggregateScheduledIncome(events: readonly B3ScheduledEvent[]): Map<string, number> {
  const byTicker = new Map<string, number>();
  for (const e of events) {
    byTicker.set(e.ticker, (byTicker.get(e.ticker) ?? 0) + e.netValue);
  }
  return byTicker;
}

/**
 * Compute weighted-average cost per ticker from chronological trades using
 * the Brazilian fiscal method: avg only changes on buys (sells reduce
 * quantity but keep avg per remaining share).
 */
export function computeAverageCost(trades: readonly B3Trade[]): Map<string, number> {
  const byTicker = new Map<string, B3Trade[]>();
  for (const t of trades) {
    const list = byTicker.get(t.ticker) ?? [];
    list.push(t);
    byTicker.set(t.ticker, list);
  }
  const result = new Map<string, number>();
  for (const [ticker, list] of Array.from(byTicker.entries())) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let qty = 0;
    let avg = 0;
    for (const t of sorted) {
      if (t.side === "buy") {
        const newQty = qty + t.quantity;
        avg = newQty > 0 ? (qty * avg + t.quantity * t.price) / newQty : 0;
        qty = newQty;
      } else {
        qty -= t.quantity;
        if (qty <= 0) { qty = 0; avg = 0; }
      }
    }
    if (avg > 0) result.set(ticker, avg);
  }
  return result;
}

