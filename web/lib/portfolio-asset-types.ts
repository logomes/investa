import type { TaxProfile } from "./api-types";

export type PortfolioAssetTypeId =
  | "FII"
  | "ACAO_BR_DIV"
  | "ACAO_BR_CRESC"
  | "ETF_BR"
  | "STOCK_US"
  | "REIT_US"
  | "ETF_US"
  | "RF_PUBLICO"
  | "RF_PRIVADO"
  | "CUSTOM";

export type PortfolioAssetTypeMeta = {
  id: PortfolioAssetTypeId;
  label: string;
  defaults: {
    expectedYield: number;
    capitalGain: number;
    taxRate: number;
    volatility: number;
    taxProfile: TaxProfile;
  };
};

export const PORTFOLIO_ASSET_TYPES: PortfolioAssetTypeMeta[] = [
  { id: "FII",           label: "FII (Papel/Tijolo/Agro/FoF)", defaults: { expectedYield: 0.110, capitalGain: 0.01, taxRate: 0.000, volatility: 0.15, taxProfile: "fii" } },
  { id: "ACAO_BR_DIV",   label: "Ações BR (dividendos)",       defaults: { expectedYield: 0.090, capitalGain: 0.03, taxRate: 0.000, volatility: 0.27, taxProfile: "acoes_br" } },
  { id: "ACAO_BR_CRESC", label: "Ações BR (crescimento)",      defaults: { expectedYield: 0.030, capitalGain: 0.07, taxRate: 0.150, volatility: 0.30, taxProfile: "acoes_br" } },
  { id: "ETF_BR",        label: "ETFs BR",                     defaults: { expectedYield: 0.020, capitalGain: 0.08, taxRate: 0.150, volatility: 0.20, taxProfile: "acoes_br" } },
  { id: "STOCK_US",      label: "Stocks US (Aristocrats)",     defaults: { expectedYield: 0.040, capitalGain: 0.06, taxRate: 0.300, volatility: 0.18, taxProfile: "dividendos_exterior" } },
  { id: "REIT_US",       label: "REITs US",                    defaults: { expectedYield: 0.050, capitalGain: 0.04, taxRate: 0.300, volatility: 0.18, taxProfile: "dividendos_exterior" } },
  { id: "ETF_US",        label: "ETFs US",                     defaults: { expectedYield: 0.020, capitalGain: 0.07, taxRate: 0.300, volatility: 0.16, taxProfile: "dividendos_exterior" } },
  { id: "RF_PUBLICO",    label: "Renda Fixa Tesouro/LCI",      defaults: { expectedYield: 0.115, capitalGain: 0.00, taxRate: 0.100, volatility: 0.05, taxProfile: "rf_regressiva" } },
  { id: "RF_PRIVADO",    label: "Renda Fixa CDB/Debênture",    defaults: { expectedYield: 0.130, capitalGain: 0.00, taxRate: 0.175, volatility: 0.07, taxProfile: "rf_regressiva" } },
  { id: "CUSTOM",        label: "Personalizado",               defaults: { expectedYield: 0.000, capitalGain: 0.00, taxRate: 0.000, volatility: 0.10, taxProfile: "tributado_anual" } },
];

export function profileForAssetName(name: string): TaxProfile {
  const meta = PORTFOLIO_ASSET_TYPES.find((t) => t.label === name);
  return meta ? meta.defaults.taxProfile : "tributado_anual";
}

export const PORTFOLIO_TYPE_BY_ID: Record<PortfolioAssetTypeId, PortfolioAssetTypeMeta> =
  Object.fromEntries(PORTFOLIO_ASSET_TYPES.map((t) => [t.id, t])) as Record<PortfolioAssetTypeId, PortfolioAssetTypeMeta>;

const PALETTE = [
  "#5CC8FF", "#FFC857", "#46E8A4", "#FF6B5B",
  "#C39BD3", "#FFB088", "#7DCFFF", "#A2E5C0",
];

export function assignColor(idx: number): string {
  return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

export const MAX_PORTFOLIO_ASSETS = 12;
