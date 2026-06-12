"use client";

import { Target } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { formatRs } from "@/lib/format";

type Props = { base: number; horizonYears: number };

export function KpiBaseCard({ base, horizonYears }: Props) {
  return (
    <div className="grid grid-cols-1">
      <div className="relative">
        <KpiCard
          label={`Patrimônio Carteira ao fim de ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
          value={formatRs(base)}
          icon={Target}
          feature
          valueColor="green"
          sub="cenário base — variações abaixo"
        />
        <div className="absolute top-3 right-3">
          <DisplayModeBadge />
        </div>
      </div>
    </div>
  );
}
