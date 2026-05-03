"use client";

import { Target } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { formatRs } from "@/lib/format";

type Props = { base: number; horizonYears: number };

export function KpiBaseCard({ base, horizonYears }: Props) {
  return (
    <div className="grid grid-cols-1">
      <KpiCard
        label={`Patrimônio Imóvel ao fim de ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
        value={formatRs(base)}
        icon={Target}
        feature
        valueColor="green"
        sub="cenário base — variações abaixo"
      />
    </div>
  );
}
