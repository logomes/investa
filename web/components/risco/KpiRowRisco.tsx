"use client";

import { Target, BarChart3, TrendingDown, Activity } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import type { RiskStats } from "@/lib/risco-derive";
import { formatPercent, formatRsK } from "@/lib/format";

type Props = {
  pfStats: RiskStats;
  benchmarkFinal: number;
  hasTarget: boolean;
};

export function KpiRowRisco({ pfStats, benchmarkFinal, hasTarget }: Props) {
  const probMetaValue = hasTarget ? formatPercent(pfStats.probTarget!, 1) : "—";
  const probMetaSub = hasTarget ? "trajetórias acima da meta" : "configure meta no Drawer";
  const probMetaColor = hasTarget && pfStats.probTarget! >= 0.7 ? "green" : "default";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Probabilidade de bater meta"
        value={probMetaValue}
        sub={probMetaSub}
        icon={Target}
        feature={hasTarget}
        valueColor={probMetaColor}
      />
      <KpiCard
        label="Patrimônio mediano (p50)"
        value={formatRsK(pfStats.finalP50)}
        sub={`Benchmark: ${formatRsK(benchmarkFinal)}`}
        icon={BarChart3}
      />
      <KpiCard
        label="Pior cenário (p10)"
        value={formatRsK(pfStats.finalP10)}
        sub="10% das trajetórias abaixo"
        icon={TrendingDown}
      />
      <KpiCard
        label="Drawdown médio máx."
        value={formatPercent(pfStats.meanMaxDrawdown, 1)}
        sub="média dos máximos por trajetória"
        icon={Activity}
        valueColor="red"
      />
    </div>
  );
}
