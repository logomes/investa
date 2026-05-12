import type { AssetClass } from "./ativos-schema";

// B3 ticker conventions:
//   *3       → ON (ação)
//   *4..*8   → PN (ação)
//   *11      → FII or ETF (ambiguous from ticker alone — fall back to FII unless whitelisted)
//   *34..*39 → BDR (4-letter + 2-digit suffix)
const BDR = /^[A-Z]{4}3[4-9]$/;
const FII_OR_ETF_11 = /^[A-Z]{4}11$/;
const ACAO_BR = /^[A-Z]{4}[3-8]$/;

// Well-known Brazilian ETFs that share the *11 suffix with FIIs.
// Default for *11 is FII; this set tips the inference to ETF_BR instead.
const KNOWN_ETF_BR = new Set([
  "BOVA11", "IVVB11", "SMAL11", "BBSD11", "ECOO11", "DIVO11",
  "FIND11", "GOVE11", "MATB11", "MOBI11", "PIBB11", "SMAC11",
]);

// Brazilian UNITs that also use the *11 suffix but are *not* FIIs —
// they're composite share securities (typically 1 ON + 2 PN) of a
// regular company. Without this whitelist they'd fall into "FII" by
// default, which is wrong.
export const KNOWN_UNITS_BR = new Set([
  "TAEE11", // Taesa (transmissão de energia)
  "KLBN11", // Klabin (papel e celulose)
  "SAPR11", // Sanepar (saneamento PR)
  "SANB11", // Banco Santander BR
  "ENGI11", // Energisa
  "BPAC11", // BTG Pactual
  "ALUP11", // Alupar (transmissão)
  "IGTI11", // Iguatemi (shoppings — operadora, não FII)
  "RAPT11", // Randon (autopeças)
  "SULA11", // SulAmérica (seguros)
]);

/**
 * Infer asset class from a ticker symbol.
 * Returns null when the ticker doesn't match any known pattern — caller keeps
 * the current class selection in that case.
 */
export function inferAssetClass(ticker: string): AssetClass | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  if (BDR.test(t)) return "BDR";
  if (FII_OR_ETF_11.test(t)) {
    if (KNOWN_ETF_BR.has(t)) return "ETF_BR";
    if (KNOWN_UNITS_BR.has(t)) return "ACAO_BR_DIVIDENDO";
    return "FII";
  }
  if (ACAO_BR.test(t)) return "ACAO_BR_DIVIDENDO";
  if (/^[A-Z]+$/.test(t)) return "STOCK_US";

  return null;
}
