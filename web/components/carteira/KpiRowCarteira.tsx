"use client";

import { TrendingUp, ArrowUpRight, BarChart3, Wallet } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import {
  blendedYield, blendedCapitalGain, totalReturn, annualIncome,
} from "@/lib/carteira-derive";
import { formatPercent, formatRs } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function KpiRowCarteira({ pf }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="DY blended"
        value={formatPercent(blendedYield(pf), 2)}
        icon={TrendingUp}
        sub="líquido após IR"
      />
      <KpiCard
        label="Ganho de capital esp."
        value={formatPercent(blendedCapitalGain(pf), 2)}
        icon={ArrowUpRight}
        sub="valorização ponderada"
      />
      <KpiCard
        label="Retorno total a.a."
        value={formatPercent(totalReturn(pf), 2)}
        icon={BarChart3}
        feature
        valueColor="green"
      />
      <KpiCard
        label="Renda anual estimada"
        value={formatRs(annualIncome(pf))}
        icon={Wallet}
        sub="capital × DY"
      />
    </div>
  );
}
