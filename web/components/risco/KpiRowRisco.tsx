"use client";

import { Target, BarChart3, TrendingDown, Activity } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import type { RiskStats } from "@/lib/risco-derive";
import { formatPercent, formatRsK } from "@/lib/format";

type Props = {
  reStats: RiskStats;
  pfStats: RiskStats;
  hasTarget: boolean;
};

export function KpiRowRisco({ reStats, pfStats, hasTarget }: Props) {
  const probMetaValue = hasTarget ? formatPercent(pfStats.probTarget!, 1) : "—";
  const probMetaSub = hasTarget
    ? `Imóvel: ${formatPercent(reStats.probTarget!, 1)}`
    : "configure meta no Drawer";
  const probMetaColor = hasTarget && pfStats.probTarget! >= 0.7 ? "green" : "default";

  return (
    <div className="grid grid-cols-4 gap-4">
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
        sub={`Imóvel: ${formatRsK(reStats.finalP50)}`}
        icon={BarChart3}
      />
      <KpiCard
        label="Pior cenário (p10)"
        value={formatRsK(pfStats.finalP10)}
        sub={`Imóvel: ${formatRsK(reStats.finalP10)}`}
        icon={TrendingDown}
      />
      <KpiCard
        label="Drawdown médio máx."
        value={formatPercent(pfStats.meanMaxDrawdown, 1)}
        sub={`Imóvel: ${formatPercent(reStats.meanMaxDrawdown, 1)}`}
        icon={Activity}
        valueColor="red"
      />
    </div>
  );
}
