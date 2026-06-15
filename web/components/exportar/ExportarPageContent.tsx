"use client";

import { useScenarioStore } from "@/lib/store";
import { useSimulate } from "@/lib/api";
import { useDeflation } from "@/lib/use-deflation";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { buildLongFormatRows, deflateRows } from "@/lib/exportar-csv";
import { ExportPreviewCard } from "./ExportPreviewCard";

export function ExportarPageContent() {
  const horizon = useScenarioStore((s) => s.scenario.horizon);
  const sim = useSimulate();
  const { isReal, ipca } = useDeflation();

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

  const baseRows = buildLongFormatRows(sim.data!);
  const rows = isReal ? deflateRows(baseRows, ipca) : baseRows;

  return (
    <div className="space-y-6">
      <ExportPreviewCard rows={rows} horizonYears={horizon} mode={isReal ? "real" : "nominal"} />
    </div>
  );
}
