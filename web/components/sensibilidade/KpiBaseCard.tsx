"use client";

import { Target } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { useScenarioStore } from "@/lib/store";
import { formatRs } from "@/lib/format";

type Props = { base: number; horizonYears: number };

export function KpiBaseCard({ base, horizonYears }: Props) {
  const isReal = useScenarioStore((s) => s.displayMode) === "real";
  return (
    <div className="grid grid-cols-1">
      <KpiCard
        label={`Patrimônio Carteira ao fim de ${horizonYears} ${horizonYears === 1 ? "ano" : "anos"}`}
        value={formatRs(base)}
        icon={Target}
        feature
        valueColor="green"
        sub={isReal ? "cenário base — variações abaixo · R$ de hoje" : "cenário base — variações abaixo"}
      />
    </div>
  );
}
