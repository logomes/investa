"use client";

import { useScenarioStore } from "@/lib/store";
import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { buildLongFormatRows } from "@/lib/exportar-csv";
import { ExportPreviewCard } from "./ExportPreviewCard";

export function ExportarPageContent() {
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

  const rows = buildLongFormatRows(sim.data!);

  return (
    <div className="space-y-6">
      <ExportPreviewCard rows={rows} horizonYears={horizon} />
    </div>
  );
}
