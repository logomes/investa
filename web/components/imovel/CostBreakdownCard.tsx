"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { costBreakdown, totalCosts } from "@/lib/imovel-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function CostBreakdownCard({ re }: Props) {
  const items = costBreakdown(re);
  const total = totalCosts(re);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Decomposição de custos</h3>
          <span className="text-xs text-ink-3 tabular">{formatRs(total)} total</span>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem custos configurados</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pct = total > 0 ? item.value / total : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="text-ink-3 tabular">
                      {formatRs(item.value)} <span className="text-ink-4">· {formatPercent(pct, 1)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
