"use client";

import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import {
  grossYield, netYield, netAnnualIncome, totalCosts, grossAnnualRent,
} from "@/lib/imovel-derive";
import { formatPercent, formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function KpiRowImovel({ re }: Props) {
  const gy = grossYield(re);
  const ny = netYield(re);
  const netIncome = netAnnualIncome(re);
  const costs = totalCosts(re);
  const costRatio = grossAnnualRent(re) > 0 ? costs / grossAnnualRent(re) : 0;
  const yieldDelta = ny - gy;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Yield Bruto"
        value={formatPercent(gy, 2)}
        icon={TrendingUp}
        sub="aluguel anual / valor"
      />
      <KpiCard
        label="Yield Líquido"
        value={formatPercent(ny, 2)}
        delta={{ value: formatPercent(yieldDelta, 2), dir: "down" }}
        icon={TrendingDown}
        sub="após custos"
      />
      <KpiCard
        label="Receita Líquida Anual"
        value={formatRs(netIncome)}
        icon={Wallet}
        valueColor="green"
      />
      <KpiCard
        label="Custo Total Anual"
        value={formatRs(costs)}
        icon={Receipt}
        sub={`${formatPercent(costRatio, 1)} da receita`}
        valueColor="red"
      />
    </div>
  );
}
