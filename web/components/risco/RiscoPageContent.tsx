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
        <div className="grid grid-cols-4 gap-4">
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
  const years = sim.data!.realEstate.years;
  const reStats = riskStats({ result: data.realEstate, target, capitalInitial: capital });
  const pfStats = riskStats({ result: data.portfolio, target, capitalInitial: capital });
  const lossInfo = lossRateInfo({
    realEstateRate: reStats.lossRate,
    portfolioRate: pfStats.lossRate,
  });

  return (
    <div className="space-y-6">
      <LossRateBanner info={lossInfo} capitalInitial={capital} />
      <KpiRowRisco reStats={reStats} pfStats={pfStats} hasTarget={target > 0} />
      <MCBandCard
        realEstate={data.realEstate}
        portfolio={data.portfolio}
        years={years}
        nTrajectories={nTrajectories}
      />
      <DistributionCard
        realEstate={data.realEstate}
        portfolio={data.portfolio}
        target={target}
      />
    </div>
  );
}
