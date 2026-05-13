import type { AssetPosition } from "./ativos-schema";
import type { MacroOut } from "./api-types";
import { positionValueBRL } from "./ativos-derive";
import { inferSector, SECTOR_COLOR, type Sector } from "./sector-mapping";

export type SectorGroup = {
  sector: Sector;
  color: string;
  positions: number;
  totalBRL: number;
  weight: number;
  tickers: string[];
};

export function bySector(positions: AssetPosition[], macro: MacroOut): SectorGroup[] {
  const valuesBRL = positions.map((p) => positionValueBRL(p, macro));
  const total = valuesBRL.reduce((s, v) => s + v, 0);
  const grouped = new Map<Sector, { count: number; sum: number; tickers: string[] }>();
  positions.forEach((p, i) => {
    const sector = inferSector(p.ticker, p.assetClass);
    const cur = grouped.get(sector) ?? { count: 0, sum: 0, tickers: [] };
    cur.count += 1;
    cur.sum += valuesBRL[i];
    cur.tickers.push(p.ticker.toUpperCase());
    grouped.set(sector, cur);
  });
  return Array.from(grouped.entries())
    .map(([sector, { count, sum, tickers }]) => ({
      sector,
      color: SECTOR_COLOR[sector],
      positions: count,
      totalBRL: sum,
      weight: total > 0 ? sum / total : 0,
      tickers: tickers.slice().sort(),
    }))
    .sort((a, b) => b.totalBRL - a.totalBRL);
}

export type SectorConcentration = {
  maxSector: Sector | null;
  maxWeight: number;
  level: "ok" | "warning" | "critical";
  warningThreshold: number;
  criticalThreshold: number;
};

const WARNING_THRESHOLD = 0.25;
const CRITICAL_THRESHOLD = 0.40;

export function sectorConcentration(groups: SectorGroup[]): SectorConcentration {
  if (groups.length === 0) {
    return {
      maxSector: null,
      maxWeight: 0,
      level: "ok",
      warningThreshold: WARNING_THRESHOLD,
      criticalThreshold: CRITICAL_THRESHOLD,
    };
  }
  const top = groups[0];
  const level =
    top.weight >= CRITICAL_THRESHOLD ? "critical" :
    top.weight >= WARNING_THRESHOLD ? "warning" : "ok";
  return {
    maxSector: top.sector,
    maxWeight: top.weight,
    level,
    warningThreshold: WARNING_THRESHOLD,
    criticalThreshold: CRITICAL_THRESHOLD,
  };
}
