import { z } from "zod";

export const assetClassSchema = z.enum([
  "FII",
  "ACAO_BR_DIVIDENDO",
  "ACAO_BR_CRESCIMENTO",
  "ETF_BR",
  "BDR",
  "STOCK_US",
  "REIT_US",
  "ETF_US",
]);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const fiiSubtypeSchema = z.enum([
  "papel",   // Recebíveis (CRI/CRA, dívida imobiliária)
  "tijolo",  // Imóveis físicos (galpões, shoppings, lajes)
  "agro",    // Fiagro / agronegócio
  "fof",     // Fund of funds (carteira de outros FIIs)
  "hibrido", // Mix de papel + tijolo (ou outro)
]);
export type FiiSubtype = z.infer<typeof fiiSubtypeSchema>;

export const FII_SUBTYPE_LABEL: Record<FiiSubtype, string> = {
  papel: "Papel",
  tijolo: "Tijolo",
  agro: "Agro",
  fof: "FoF",
  hibrido: "Híbrido",
};

export const currencySchema = z.enum(["BRL", "USD"]);
export type Currency = z.infer<typeof currencySchema>;

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

export const assetPositionSchema = z.object({
  id: z.string().min(1),
  ticker: z.string().min(1).max(12).regex(/^[A-Za-z0-9.]+$/, "ticker: letras/números/ponto"),
  assetClass: assetClassSchema,
  currency: currencySchema,
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  expectedYield: z.number().min(0).max(1),
  capitalGain: z.number().min(-1).max(1),
  color: z.string().regex(colorRegex),
  currentPrice: z.number().positive().optional(),
  asOf: z.string().datetime().optional(),
  fiiSubtype: fiiSubtypeSchema.optional(),
});

export type AssetPosition = z.infer<typeof assetPositionSchema>;

type AssetClassMeta = {
  label: string;
  market: "BR" | "US";
  defaultCurrency: Currency;
  taxRate: number;
  taxNote: string;
  color: string;
  defaultYield: number;
  defaultCapitalGain: number;
};

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  FII: {
    label: "FII",
    market: "BR",
    defaultCurrency: "BRL",
    taxRate: 0,
    taxNote: "Rendimentos isentos PF (Papel, Tijolo, Agro, FoF, Híbrido)",
    color: "#FFC857",
    defaultYield: 0.11,
    defaultCapitalGain: 0.01,
  },
  ACAO_BR_DIVIDENDO: {
    label: "Ação BR (dividendo)",
    market: "BR",
    defaultCurrency: "BRL",
    taxRate: 0,
    taxNote: "Dividendos isentos até R$ 50k/mês por empresa",
    color: "#5CC8FF",
    defaultYield: 0.08,
    defaultCapitalGain: 0.03,
  },
  ACAO_BR_CRESCIMENTO: {
    label: "Ação BR (crescimento)",
    market: "BR",
    defaultCurrency: "BRL",
    taxRate: 0,
    taxNote: "Dividendos isentos até R$ 50k/mês",
    color: "#46E8A4",
    defaultYield: 0.02,
    defaultCapitalGain: 0.10,
  },
  ETF_BR: {
    label: "ETF BR",
    market: "BR",
    defaultCurrency: "BRL",
    taxRate: 0.15,
    taxNote: "15% sobre ganho de capital",
    color: "#C39BD3",
    defaultYield: 0,
    defaultCapitalGain: 0.10,
  },
  BDR: {
    label: "BDR",
    market: "BR",
    defaultCurrency: "BRL",
    taxRate: 0.15,
    taxNote: "15% sobre ganho; dividendos têm IR retido na origem",
    color: "#FFB088",
    defaultYield: 0.02,
    defaultCapitalGain: 0.08,
  },
  STOCK_US: {
    label: "Stock US",
    market: "US",
    defaultCurrency: "USD",
    taxRate: 0.30,
    taxNote: "30% retido em dividendos (tratado pode reduzir)",
    color: "#7DCFFF",
    defaultYield: 0.04,
    defaultCapitalGain: 0.06,
  },
  REIT_US: {
    label: "REIT US",
    market: "US",
    defaultCurrency: "USD",
    taxRate: 0.30,
    taxNote: "30% retido em dividendos",
    color: "#A2E5C0",
    defaultYield: 0.05,
    defaultCapitalGain: 0.03,
  },
  ETF_US: {
    label: "ETF US",
    market: "US",
    defaultCurrency: "USD",
    taxRate: 0.30,
    taxNote: "30% retido em dividendos",
    color: "#F8C471",
    defaultYield: 0.02,
    defaultCapitalGain: 0.07,
  },
};
