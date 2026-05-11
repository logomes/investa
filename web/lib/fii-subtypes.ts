import type { FiiSubtype } from "./ativos-schema";

/**
 * Curated subtype mapping for the most-traded Brazilian FIIs.
 *
 * Source notes:
 * - Subtypes derived from CVM monthly informe (`Segmento` field) and from
 *   each fund's public mandate.
 * - Cobertura aproximada: ~80% do volume diário do mercado de FIIs.
 * - Última revisão manual: 2026-05-11. Adicione/corrija conforme novos
 *   FIIs ganham relevância. Tickers ausentes ficam como "FII" genérico.
 *
 * Future: replace this static table with the CVM open data ETL described
 * in docs/superpowers/FUTURE_IMPROVEMENTS.md (the `/api/fii-metadata`
 * endpoint provides the seam without forcing a frontend redeploy).
 */
export const FII_SUBTYPES: Record<string, FiiSubtype> = {
  // Papel — Recebíveis (CRI/CRA, dívida imobiliária)
  MXRF11: "papel",
  HGCR11: "papel",
  KNCR11: "papel",
  KNIP11: "papel",
  KNHF11: "papel",
  IRDM11: "papel",
  RBRR11: "papel",
  CPTS11: "papel",
  BCRI11: "papel",
  RECR11: "papel",
  BTCR11: "papel",
  AFHI11: "papel",
  VGIR11: "papel",
  DEVA11: "papel",
  VRTA11: "papel",
  RBRY11: "papel",
  HSAF11: "papel",
  BARI11: "papel",
  KCRE11: "papel",
  PORD11: "papel",

  // Tijolo — Imóveis físicos
  HGLG11: "tijolo",
  KNRI11: "tijolo",
  HGRU11: "tijolo",
  BRCO11: "tijolo",
  XPLG11: "tijolo",
  BTLG11: "tijolo",
  VILG11: "tijolo",
  ALZR11: "tijolo",
  VINO11: "tijolo",
  JSRE11: "tijolo",
  HSML11: "tijolo",
  MALL11: "tijolo",
  VISC11: "tijolo",
  XPML11: "tijolo",
  RBRP11: "tijolo",
  RNGO11: "tijolo",
  RBVA11: "tijolo",
  RBED11: "tijolo",
  HGBS11: "tijolo",
  BBPO11: "tijolo",
  BBRC11: "tijolo",
  HGRE11: "tijolo",
  PVBI11: "tijolo",
  TRXF11: "tijolo",
  HCTR11: "tijolo",
  KORE11: "tijolo",

  // Agro — Fiagro / agronegócio
  RURA11: "agro",
  RZAG11: "agro",
  FGAA11: "agro",
  GCRA11: "agro",
  VCRA11: "agro",
  CRAA11: "agro",
  TGAR11: "agro",

  // FoF — Fund of Funds
  BCFF11: "fof",
  BPFF11: "fof",
  KFOF11: "fof",
  HFOF11: "fof",
  BCIA11: "fof",
  RBFF11: "fof",
  HGFF11: "fof",
  CXTL11: "fof",
  CPFF11: "fof",
};

/**
 * Resolve the curated subtype for a ticker. Case-insensitive. Returns
 * undefined when the ticker isn't on the curated list — caller should
 * leave the position's `fiiSubtype` as undefined in that case (UI shows
 * just "FII").
 */
export function lookupFiiSubtype(ticker: string): FiiSubtype | undefined {
  return FII_SUBTYPES[ticker.trim().toUpperCase()];
}
