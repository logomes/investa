"use client";

import { Receipt, Percent, TimerReset, Sparkles } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { useDeflation } from "@/lib/use-deflation";
import type { TaxKpis } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";

type Props = { kpis: TaxKpis; horizon: number };

export function KpiRowTributacao({ kpis, horizon }: Props) {
  const { isReal, at } = useDeflation();
  const suffix = isReal ? " · R$ de hoje" : "";

  const pathTax = kpis.totalTax - kpis.latentExitTax;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="IR total no horizonte"
        value={formatRs(at(kpis.totalTax, horizon))}
        icon={Receipt}
        sub={`caminho ${formatRs(at(pathTax, horizon))} + saída ${formatRs(at(kpis.latentExitTax, horizon))}`}
      />
      <KpiCard
        label="Alíquota efetiva"
        value={formatPercent(kpis.effectiveRate, 1)}
        icon={Percent}
        sub="do ganho bruto"
      />
      <KpiCard
        label="IR latente na saída"
        value={formatRs(at(kpis.latentExitTax, horizon))}
        icon={TimerReset}
        sub={`devido ao resgatar${suffix}`}
      />
      <KpiCard
        label="Suas isenções valem"
        value={formatRs(at(kpis.exemptionValue, horizon))}
        icon={Sparkles}
        feature
        valueColor="green"
        sub={`vs. tudo tributado${suffix}`}
      />
    </div>
  );
}
