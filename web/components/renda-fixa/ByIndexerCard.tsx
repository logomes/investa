"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { byIndexer } from "@/lib/fi-derive";
import { formatRsK, formatPercent } from "@/lib/format";

const INDEXER_LABELS: Record<string, string> = {
  prefixado: "Prefixado",
  cdi: "% CDI",
  selic: "Selic +",
  ipca: "IPCA +",
};

const INDEXER_BAR_COLORS: Record<string, string> = {
  prefixado: "bg-accent-amber",
  cdi: "bg-accent-cyan",
  selic: "bg-brand-bright",
  ipca: "bg-accent-coral",
};

export function ByIndexerCard() {
  const positions = useFixedIncomeStore((s) => s.positions);
  const groups = byIndexer(positions);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Por indexador</h3>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem posições</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.indexer}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-medium text-ink">{INDEXER_LABELS[g.indexer]}</span>
                  <span className="text-ink-3 tabular">
                    {formatRsK(g.total)} · {formatPercent(g.pct, 1)}
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-pill overflow-hidden">
                  <div
                    className={`h-full ${INDEXER_BAR_COLORS[g.indexer]} rounded-pill transition-all`}
                    style={{ width: `${g.pct * 100}%` }}
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
