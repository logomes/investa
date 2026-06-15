"use client";

import { useMonteCarlo, useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { riskStats, lossRateInfo } from "@/lib/risco-derive";
import { LossRateBanner } from "./LossRateBanner";
import { KpiRowRisco } from "./KpiRowRisco";
import { MCBandCard } from "./MCBandCard";
import { DistributionCard } from "./DistributionCard";

export function RiscoPageContent() {
  const capital = useScenarioStore((s) => s.scenario.capital);
  const target = useScenarioStore((s) => s.mc.targetPatrimony);
  const nTrajectories = useScenarioStore((s) => s.mc.nTrajectories);
  const mc = useMonteCarlo();
  const sim = useSimulate();

  if (mc.isLoading || sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (mc.error || sim.error) {
    return (
      <ErrorCard
        onRetry={() => {
          mc.refetch();
          sim.refetch();
        }}
      />
    );
  }

  const data = mc.data!;
  const benchmark = sim.data!.benchmark;
  const years = sim.data!.portfolio.years;
  const pfStats = riskStats({ result: data.portfolio, target, capitalInitial: capital });
  const lossInfo = lossRateInfo({ portfolioRate: pfStats.lossRate });
  const benchmarkFinal = benchmark.patrimony[benchmark.patrimony.length - 1];

  return (
    <div className="space-y-6">
      <LossRateBanner info={lossInfo} capitalInitial={capital} />
      <KpiRowRisco pfStats={pfStats} benchmarkFinal={benchmarkFinal} hasTarget={target > 0} />
      <MCBandCard
        portfolio={data.portfolio}
        benchmark={benchmark}
        years={years}
        nTrajectories={nTrajectories}
      />
      <DistributionCard portfolio={data.portfolio} target={target} />
    </div>
  );
}
