"use client";

import { useScenarioStore } from "@/lib/store";
import { useMacro } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { KpiRowCarteira } from "./KpiRowCarteira";
import { AllocationDonutCard } from "./AllocationDonutCard";
import { AllocationTable } from "./AllocationTable";
import { YieldComparisonCard } from "./YieldComparisonCard";

export function CarteiraPageContent() {
  const scenario = useScenarioStore((s) => s.scenario);
  const macro = useMacro();

  if (macro.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (macro.error) {
    return <ErrorCard onRetry={() => macro.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <KpiRowCarteira pf={scenario.portfolio} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AllocationDonutCard pf={scenario.portfolio} />
        <AllocationTable pf={scenario.portfolio} />
      </div>
      <YieldComparisonCard
        pf={scenario.portfolio}
        benchmark={scenario.benchmark}
        horizonYears={scenario.horizon}
        macro={macro.data!}
      />
    </div>
  );
}
