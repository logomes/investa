"use client";

import { useState } from "react";
import { useSimulate, useMonteCarlo } from "@/lib/api";
import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { TimelineFilter, type TimelineValue } from "@/components/charts/TimelineFilter";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK } from "@/lib/format";

function rangeToSlice(range: TimelineValue, totalYears: number): number {
  if (range === "1A") return Math.min(2, totalYears);
  if (range === "5A") return Math.min(6, totalYears);
  if (range === "10A") return Math.min(11, totalYears);
  return totalYears;  // Tudo
}

export function EvolutionCard() {
  const [range, setRange] = useState<TimelineValue>("10A");
  const sim = useSimulate();
  const mc = useMonteCarlo();

  if (sim.isLoading) {
    return (
      <div className="bg-bg-2 border border-line rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13.5px] font-semibold text-ink">Evolução do patrimônio</h3>
        </div>
        <ChartSkeleton height={300} />
      </div>
    );
  }
  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const totalYears = data.portfolio.years.length;
  const sliceN = rangeToSlice(range, totalYears);

  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: data.portfolio.patrimony.slice(0, sliceN) },
    { name: data.realEstate.label, color: data.realEstate.color, values: data.realEstate.patrimony.slice(0, sliceN) },
    { name: data.benchmark.label, color: data.benchmark.color, values: data.benchmark.patrimony.slice(0, sliceN) },
  ];

  const bands = mc.data
    ? [
        {
          name: `${mc.data.portfolio.label} p10–p90`,
          color: "rgba(39, 174, 96, 0.18)",
          lower: mc.data.portfolio.p10.slice(0, sliceN),
          upper: mc.data.portfolio.p90.slice(0, sliceN),
        },
        {
          name: `${mc.data.realEstate.label} p10–p90`,
          color: "rgba(192, 57, 43, 0.14)",
          lower: mc.data.realEstate.p10.slice(0, sliceN),
          upper: mc.data.realEstate.p90.slice(0, sliceN),
        },
      ]
    : undefined;

  const xLabels = Array.from({ length: sliceN }, (_, i) => `Y${i}`);

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13.5px] font-semibold text-ink">Evolução do patrimônio</h3>
        <TimelineFilter value={range} onChange={setRange} />
      </div>
      <LineChart series={series} bands={bands} xLabels={xLabels} width={780} height={300} yFormat={(v) => formatRsK(v).replace("R$ ", "R$")} />
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        {bands && (
          <span className="ml-auto text-[11px] text-ink-3">Banda p10–p90 · Monte Carlo {mc.data!.portfolio.finalDistribution.length / 1000}k</span>
        )}
      </div>
    </div>
  );
}
