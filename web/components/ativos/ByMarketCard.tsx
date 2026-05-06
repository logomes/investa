"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MarketSplit } from "@/lib/ativos-derive";
import type { MacroOut } from "@/lib/api-types";
import { formatRsK, formatPercent } from "@/lib/format";

type Props = { split: MarketSplit; macro: MacroOut };

const BR_COLOR = "#46E8A4";
const US_COLOR = "#5CC8FF";

export function ByMarketCard({ split, macro }: Props) {
  const empty = split.br.totalBRL === 0 && split.us.totalBRL === 0;
  const usdBrl = macro.usdBrl.toFixed(2).replace(".", ",");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Por mercado</h3>
          <span className="text-[10px] text-ink-3">USD/BRL = {usdBrl} · {macro.sourceLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem posições</p>
        ) : (
          <div className="space-y-3">
            {[
              { label: "Brasil", color: BR_COLOR, slot: split.br },
              { label: "EUA",    color: US_COLOR, slot: split.us },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-ink">{row.label}</span>
                    <span className="text-ink-4 text-[10px]">({row.slot.positions} posições)</span>
                  </div>
                  <span className="text-ink-3 tabular">
                    {formatRsK(row.slot.totalBRL)} <span className="text-ink-4">· {formatPercent(row.slot.weight, 1)}</span>
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.slot.weight * 100}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
