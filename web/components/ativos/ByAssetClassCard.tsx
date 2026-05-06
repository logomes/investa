"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AssetClassGroup } from "@/lib/ativos-derive";
import { formatRsK, formatPercent } from "@/lib/format";

type Props = { groups: AssetClassGroup[] };

export function ByAssetClassCard({ groups }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Por classe de ativo</h3>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem posições</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.assetClass}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className="font-medium text-ink">{g.label}</span>
                    <span className="text-ink-4 text-[10px]">({g.positions})</span>
                  </div>
                  <span className="text-ink-3 tabular">
                    {formatRsK(g.totalBRL)} <span className="text-ink-4">· {formatPercent(g.weight, 1)}</span>
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${g.weight * 100}%`, backgroundColor: g.color }}
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
