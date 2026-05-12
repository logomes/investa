import type { AssetClass } from "./ativos-schema";

/**
 * Sector taxonomy used by investa for risk-concentration analysis.
 * Loosely follows B3's "Setor Econômico" classification (which itself
 * derives from ICB), simplified to a flat enum so the UI can color and
 * label each one consistently.
 */
export type Sector =
  | "Bancos"
  | "Seguros"
  | "Financeiro Outros"
  | "Petróleo & Gás"
  | "Mineração & Siderurgia"
  | "Materiais Básicos"
  | "Energia Elétrica"
  | "Saneamento"
  | "Telecomunicações"
  | "Tecnologia"
  | "Saúde"
  | "Varejo & Consumo"
  | "Alimentos & Bebidas"
  | "Bens de Capital"
  | "Construção"
  | "Logística & Transporte"
  | "Educação"
  | "Imobiliário"            // FIIs
  | "Internacional"          // STOCK_US / REIT_US / BDR sem mapping
  | "Diversificado"          // ETF_BR / ETF_US
  | "Outros";

export const SECTOR_COLOR: Record<Sector, string> = {
  "Bancos": "#5CC8FF",
  "Seguros": "#7DCFFF",
  "Financeiro Outros": "#A2E5C0",
  "Petróleo & Gás": "#FFC857",
  "Mineração & Siderurgia": "#C39BD3",
  "Materiais Básicos": "#FFB088",
  "Energia Elétrica": "#46E8A4",
  "Saneamento": "#73D2DE",
  "Telecomunicações": "#FF6B5B",
  "Tecnologia": "#9CFF6B",
  "Saúde": "#E8A4E0",
  "Varejo & Consumo": "#F89F8F",
  "Alimentos & Bebidas": "#FFD46A",
  "Bens de Capital": "#88C0D0",
  "Construção": "#D4A77B",
  "Logística & Transporte": "#B8D4A8",
  "Educação": "#E5C5D9",
  "Imobiliário": "#FFC857",
  "Internacional": "#7DCFFF",
  "Diversificado": "#C7C7C7",
  "Outros": "#8E8E8E",
};

/**
 * Hand-curated ticker → sector mapping for the top ~100 most-traded
 * Brazilian tickers. Fallback hierarchy in inferSector:
 *  - FII → "Imobiliário"
 *  - STOCK_US/REIT_US/BDR → "Internacional"
 *  - ETF_BR/ETF_US → "Diversificado"
 *  - everything else → "Outros"
 *
 * Add new tickers here as they come up. Update via CVM/B3 public data
 * (or curated manually). Backend endpoint /api/sector-metadata exposes
 * the same table for future ETL.
 */
export const SECTOR_BY_TICKER: Record<string, Sector> = {
  // ===== Bancos =====
  ITUB3: "Bancos", ITUB4: "Bancos", BBAS3: "Bancos", BBDC3: "Bancos", BBDC4: "Bancos",
  SANB11: "Bancos", BPAC11: "Bancos", BMGB4: "Bancos", BRSR6: "Bancos", PINE4: "Bancos",
  ABCB4: "Bancos", BIDI4: "Bancos", BRBI11: "Bancos",

  // ===== Seguros =====
  BBSE3: "Seguros", IRBR3: "Seguros", PSSA3: "Seguros", SULA11: "Seguros", CXSE3: "Seguros",

  // ===== Financeiro Outros =====
  B3SA3: "Financeiro Outros", CIEL3: "Financeiro Outros", GETT11: "Financeiro Outros",
  WIZS3: "Financeiro Outros", BMOB3: "Financeiro Outros",

  // ===== Petróleo & Gás =====
  PETR3: "Petróleo & Gás", PETR4: "Petróleo & Gás", PRIO3: "Petróleo & Gás",
  RECV3: "Petróleo & Gás", RRRP3: "Petróleo & Gás", VBBR3: "Petróleo & Gás",
  UGPA3: "Petróleo & Gás", CSAN3: "Petróleo & Gás",

  // ===== Mineração & Siderurgia =====
  VALE3: "Mineração & Siderurgia", CSNA3: "Mineração & Siderurgia",
  CMIN3: "Mineração & Siderurgia", USIM5: "Mineração & Siderurgia",
  GGBR4: "Mineração & Siderurgia", GOAU4: "Mineração & Siderurgia",
  BRAP4: "Mineração & Siderurgia",

  // ===== Materiais Básicos (papel, celulose, química) =====
  KLBN11: "Materiais Básicos", SUZB3: "Materiais Básicos",
  UNIP6: "Materiais Básicos", BRKM5: "Materiais Básicos",
  DXCO3: "Materiais Básicos",

  // ===== Energia Elétrica =====
  CMIG3: "Energia Elétrica", CMIG4: "Energia Elétrica",
  EQTL3: "Energia Elétrica", EGIE3: "Energia Elétrica",
  CPFE3: "Energia Elétrica", ELET3: "Energia Elétrica", ELET6: "Energia Elétrica",
  TAEE11: "Energia Elétrica", TRPL4: "Energia Elétrica", ALUP11: "Energia Elétrica",
  ENGI11: "Energia Elétrica", AURE3: "Energia Elétrica", ENEV3: "Energia Elétrica",
  NEOE3: "Energia Elétrica", ISAE3: "Energia Elétrica", ISAE4: "Energia Elétrica",

  // ===== Saneamento =====
  SAPR3: "Saneamento", SAPR4: "Saneamento", SAPR11: "Saneamento",
  SBSP3: "Saneamento", CSMG3: "Saneamento", AESB3: "Saneamento",

  // ===== Telecomunicações =====
  VIVT3: "Telecomunicações", TIMS3: "Telecomunicações", OIBR3: "Telecomunicações",

  // ===== Tecnologia =====
  TOTS3: "Tecnologia", LWSA3: "Tecnologia", POSI3: "Tecnologia", IFCM3: "Tecnologia",

  // ===== Saúde =====
  RDOR3: "Saúde", HAPV3: "Saúde", FLRY3: "Saúde", QUAL3: "Saúde",
  HYPE3: "Saúde", PARD3: "Saúde", BIOM3: "Saúde", DASA3: "Saúde",

  // ===== Varejo & Consumo =====
  MGLU3: "Varejo & Consumo", LREN3: "Varejo & Consumo", AMER3: "Varejo & Consumo",
  VIIA3: "Varejo & Consumo", PETZ3: "Varejo & Consumo", ASAI3: "Varejo & Consumo",
  PCAR3: "Varejo & Consumo", BHIA3: "Varejo & Consumo", NTCO3: "Varejo & Consumo",
  GUAR3: "Varejo & Consumo", SOMA3: "Varejo & Consumo", VVAR3: "Varejo & Consumo",
  ARZZ3: "Varejo & Consumo", CEAB3: "Varejo & Consumo",

  // ===== Alimentos & Bebidas =====
  ABEV3: "Alimentos & Bebidas", JBSS3: "Alimentos & Bebidas",
  MRFG3: "Alimentos & Bebidas", BEEF3: "Alimentos & Bebidas",
  BRFS3: "Alimentos & Bebidas", MDIA3: "Alimentos & Bebidas",
  CAML3: "Alimentos & Bebidas", SMTO3: "Alimentos & Bebidas",

  // ===== Bens de Capital =====
  WEGE3: "Bens de Capital", EMBR3: "Bens de Capital",
  POMO3: "Bens de Capital", POMO4: "Bens de Capital",
  RAPT4: "Bens de Capital", RAPT11: "Bens de Capital",
  KEPL3: "Bens de Capital", FRAS3: "Bens de Capital", TUPY3: "Bens de Capital",
  MYPK3: "Bens de Capital",

  // ===== Construção =====
  MRVE3: "Construção", CYRE3: "Construção", EZTC3: "Construção",
  DIRR3: "Construção", JHSF3: "Construção", LAVV3: "Construção",
  PLPL3: "Construção", TEND3: "Construção", TRIS3: "Construção",

  // ===== Logística & Transporte =====
  RAIL3: "Logística & Transporte", CCRO3: "Logística & Transporte",
  ECOR3: "Logística & Transporte", AZUL4: "Logística & Transporte",
  GOLL4: "Logística & Transporte",
  HBSA3: "Logística & Transporte", LOGG3: "Logística & Transporte",
  TGMA3: "Logística & Transporte", VAMO3: "Logística & Transporte",
  RENT3: "Logística & Transporte", MOVI3: "Logística & Transporte",
  SIMH3: "Logística & Transporte",

  // ===== Educação =====
  YDUQ3: "Educação", COGN3: "Educação", SEER3: "Educação", ANIM3: "Educação",

  // ===== Outros (varia, deixar fallback)
  // IGTI11 já é UNIT (Iguatemi shoppings → Imobiliário ou Outros)
  IGTI11: "Imobiliário",
};

/**
 * Resolve the sector for a ticker using:
 * 1. Manual override from SECTOR_BY_TICKER if present
 * 2. Asset class fallback (FII → Imobiliário, STOCK_US → Internacional, etc.)
 * 3. "Outros" if nothing matches.
 *
 * Case-insensitive on ticker.
 */
export function inferSector(ticker: string, assetClass: AssetClass): Sector {
  const t = ticker.trim().toUpperCase();
  const explicit = SECTOR_BY_TICKER[t];
  if (explicit) return explicit;

  switch (assetClass) {
    case "FII": return "Imobiliário";
    case "ETF_BR":
    case "ETF_US":
      return "Diversificado";
    case "BDR":
    case "STOCK_US":
    case "REIT_US":
      return "Internacional";
    default:
      return "Outros";
  }
}
