"use client";

import { Wallet, TrendingUp, ArrowUpRight, BarChart3 } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import type { AtivosKpis } from "@/lib/ativos-derive";
import { formatRsK, formatPercent } from "@/lib/format";

type Props = { kpis: AtivosKpis };

export function KpiRowAtivos({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Total alocado"
        value={formatRsK(kpis.totalAllocated)}
        icon={Wallet}
        sub="BRL convertido"
      />
      <KpiCard
        label="DY blended (líq.)"
        value={formatPercent(kpis.blendedYield, 2)}
        icon={TrendingUp}
        sub="ponderado por valor"
      />
      <KpiCard
        label="Ganho capital esp."
        value={formatPercent(kpis.blendedCapitalGain, 2)}
        icon={ArrowUpRight}
        sub="valorização ponderada"
      />
      <KpiCard
        label="Retorno total a.a."
        value={formatPercent(kpis.totalReturn, 2)}
        icon={BarChart3}
        feature
        valueColor={kpis.totalReturn >= 0 ? "green" : "red"}
      />
    </div>
  );
}
