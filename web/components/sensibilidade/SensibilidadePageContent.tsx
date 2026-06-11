"use client";

import { useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { enrichRows, sortByImpact } from "@/lib/sensibilidade-derive";
import { KpiBaseCard } from "./KpiBaseCard";
import { TornadoChart } from "./TornadoChart";
import { SensibilidadeTable } from "./SensibilidadeTable";

export function SensibilidadePageContent() {
  const horizon = useScenarioStore((s) => s.scenario.horizon);
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <KpiSkeleton />
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const base = data.portfolio.patrimony[data.portfolio.patrimony.length - 1];
  const rows = sortByImpact(enrichRows(data.sensitivity, base));

  return (
    <div className="space-y-6">
      <KpiBaseCard base={base} horizonYears={horizon} />
      <TornadoChart rows={rows} base={base} />
      <SensibilidadeTable rows={rows} />
    </div>
  );
}
