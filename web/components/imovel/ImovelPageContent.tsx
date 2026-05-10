"use client";

import { useScenarioStore } from "@/lib/store";
import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { KpiRowImovel } from "./KpiRowImovel";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { IncomeVsCostsCard } from "./IncomeVsCostsCard";
import { FinancingCard } from "./FinancingCard";
import { AcquisitionCostsCard } from "./AcquisitionCostsCard";
import { RisksCard } from "./RisksCard";
import { EvolutionCard } from "./EvolutionCard";

export function ImovelPageContent() {
  const scenario = useScenarioStore((s) => s.scenario);
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const re = scenario.realEstate;
  const realEstateSim = sim.data!.realEstate;

  return (
    <div className="space-y-6">
      <KpiRowImovel re={re} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostBreakdownCard re={re} />
        <IncomeVsCostsCard re={re} />
      </div>

      {re.financing !== null && (
        <FinancingCard re={re} simulation={realEstateSim} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <EvolutionCard simulation={realEstateSim} />
        <div className="space-y-6">
          <AcquisitionCostsCard re={re} />
          <RisksCard />
        </div>
      </div>
    </div>
  );
}
