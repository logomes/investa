"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SectorGroup, SectorConcentration } from "@/lib/sector-derive";
import { formatRsK, formatPercent } from "@/lib/format";

type Props = { groups: SectorGroup[]; concentration: SectorConcentration };

export function BySectorCard({ groups, concentration }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold text-ink">Por setor</h3>
          {concentration.level === "critical" && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-accent-coral">
              <ShieldAlert className="w-3 h-3" /> Concentração crítica
            </span>
          )}
          {concentration.level === "warning" && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-accent-amber">
              <AlertTriangle className="w-3 h-3" /> Atenção
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem posições</p>
        ) : (
          <>
            {concentration.level !== "ok" && concentration.maxSector && (
              <div className={`mb-3 p-2 rounded-md text-[11.5px] leading-tight ${
                concentration.level === "critical"
                  ? "bg-accent-coral/10 text-accent-coral"
                  : "bg-accent-amber/10 text-accent-amber"
              }`}>
                <strong>{concentration.maxSector}</strong> representa {formatPercent(concentration.maxWeight, 1)} da carteira
                {concentration.level === "critical"
                  ? ` — acima de ${formatPercent(concentration.criticalThreshold, 0)}. Avalie diversificar.`
                  : ` — acima de ${formatPercent(concentration.warningThreshold, 0)}.`}
              </div>
            )}
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.sector}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      <span className="font-medium text-ink truncate">{g.sector}</span>
                      <span className="text-ink-4 text-[10px]">({g.positions})</span>
                    </div>
                    <span className="text-ink-3 tabular flex-shrink-0">
                      {formatRsK(g.totalBRL)} <span className="text-ink-4">· {formatPercent(g.weight, 1)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${g.weight * 100}%`, backgroundColor: g.color }}
                    />
                  </div>
                  {g.tickers.length > 0 && (
                    <p className="text-[10px] text-ink-4 mt-1 truncate">{g.tickers.join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
