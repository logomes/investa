"use client";

import { useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { totalContributed, taxKpis } from "@/lib/tributacao-derive";
import { KpiRowTributacao } from "./KpiRowTributacao";
import { TaxTimelineChart } from "./TaxTimelineChart";
import { TributacaoTable } from "./TributacaoTable";
import { TaxNotesCard } from "./TaxNotesCard";

export function TributacaoPageContent() {
  const sim = useSimulate();
  const scenario = useScenarioStore((s) => s.scenario);

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const contributed = totalContributed(scenario);
  const kpis = taxKpis(data, contributed);

  return (
    <div className="space-y-6">
      <KpiRowTributacao kpis={kpis} horizon={scenario.horizon} />
      <TaxTimelineChart
        taxPaidByYear={data.taxProjection.taxPaidByYear}
        exitTaxByYear={data.taxProjection.exitTaxByYear}
      />
      <TributacaoTable rows={data.taxProjection.rows} horizon={scenario.horizon} />
      <TaxNotesCard />
    </div>
  );
}
