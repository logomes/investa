"use client";

import { useMonteCarlo, useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { useDeflation } from "@/lib/use-deflation";
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
  const { isReal, at, series: deflate } = useDeflation();

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
  const horizonYears = years.length - 1;

  // Real mode: percentile paths deflate per-year; the final distribution by the
  // horizon factor. capitalInitial is year-0 money (factor 1) — lossRate then
  // means "lost purchasing power", intentionally stricter than nominal loss.
  const displayMc = isReal
    ? {
        ...data.portfolio,
        p10: deflate(data.portfolio.p10),
        p50: deflate(data.portfolio.p50),
        p90: deflate(data.portfolio.p90),
        finalDistribution: data.portfolio.finalDistribution.map((v) => at(v, horizonYears)),
      }
    : data.portfolio;
  const displayBenchmark = isReal
    ? { ...benchmark, patrimony: deflate(benchmark.patrimony) }
    : benchmark;

  // target passes through unchanged — in real mode the distribution is deflated,
  // so the user-typed target reads as today's money automatically.
  const pfStats = riskStats({ result: displayMc, target, capitalInitial: capital });
  const lossInfo = lossRateInfo({ portfolioRate: pfStats.lossRate });
  const benchmarkFinal = displayBenchmark.patrimony[displayBenchmark.patrimony.length - 1];

  return (
    <div className="space-y-6">
      <LossRateBanner info={lossInfo} capitalInitial={capital} />
      <KpiRowRisco pfStats={pfStats} benchmarkFinal={benchmarkFinal} hasTarget={target > 0} />
      <MCBandCard
        portfolio={displayMc}
        benchmark={displayBenchmark}
        years={years}
        nTrajectories={nTrajectories}
      />
      <DistributionCard portfolio={displayMc} target={target} />
    </div>
  );
}
