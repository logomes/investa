"use client";

import { Wallet, TrendingUp, Clock, Percent } from "lucide-react";
import { useMacro } from "@/lib/api";
import { useFixedIncomeStore } from "@/lib/fi-store";
import {
  totalAllocated, weightedYield, weightedDuration, effectiveIrRate,
} from "@/lib/fi-derive";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK, formatPercent } from "@/lib/format";

export function KpiRowFixedIncome() {
  const positions = useFixedIncomeStore((s) => s.positions);
  const macro = useMacro();
  const today = new Date();

  if (macro.isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }
  if (macro.error) {
    return <ErrorCard onRetry={() => macro.refetch()} />;
  }

  const total = totalAllocated(positions);
  const yield_ = weightedYield(positions, macro.data!, today);
  const duration = weightedDuration(positions, today);
  const irRate = effectiveIrRate(positions, today);

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="Total alocado RF"
        value={total > 0 ? formatRsK(total) : "—"}
        sub={positions.length > 0 ? `${positions.length} ${positions.length === 1 ? "posição" : "posições"}` : "Sem posições ainda"}
        icon={Wallet}
        feature
      />
      <KpiCard
        label="Yield blended"
        value={total > 0 ? formatPercent(yield_, 2) : "—"}
        sub="líquido após IR"
        icon={TrendingUp}
      />
      <KpiCard
        label="Duration média"
        value={total > 0 ? `${duration.toFixed(1)} anos` : "—"}
        sub="prazo ponderado"
        icon={Clock}
      />
      <KpiCard
        label="IR efetivo"
        value={total > 0 ? formatPercent(irRate, 1) : "—"}
        sub="tabela vigente"
        icon={Percent}
      />
    </div>
  );
}
