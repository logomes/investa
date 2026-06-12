"use client";

import { useState } from "react";
import { useSimulate, useMonteCarlo } from "@/lib/api";
import { useDeflation } from "@/lib/use-deflation";
import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { TimelineFilter, type TimelineValue } from "@/components/charts/TimelineFilter";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK } from "@/lib/format";
import { interpolateMonthly } from "@/lib/interpolation";

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
  const { isReal, series: deflate } = useDeflation();

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
  const isMonthly = range === "1A";

  const project = (arr: number[]) => {
    const display = isReal ? deflate(arr) : arr;
    const sliced = display.slice(0, sliceN);
    return isMonthly ? interpolateMonthly(sliced) : sliced;
  };

  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: project(data.portfolio.patrimony) },
    { name: data.benchmark.label, color: data.benchmark.color, values: project(data.benchmark.patrimony) },
  ];

  const nominalPortfolio = data.portfolio.patrimony.slice(0, sliceN);
  const realPortfolio = deflate(data.portfolio.patrimony).slice(0, sliceN);

  // MC bands are annual-only — skip on monthly view to avoid showing flat
  // segments interpolated from 2 yearly percentiles.
  const bands = !isMonthly
    ? [
        ...(mc.data
          ? [{
              name: `${mc.data.portfolio.label} p10–p90`,
              color: "rgba(39, 174, 96, 0.18)",
              lower: (isReal ? deflate(mc.data.portfolio.p10) : mc.data.portfolio.p10).slice(0, sliceN),
              upper: (isReal ? deflate(mc.data.portfolio.p90) : mc.data.portfolio.p90).slice(0, sliceN),
            }]
          : []),
        ...(isReal
          ? [{
              name: "Inflação (perda de poder de compra)",
              color: "rgba(255, 200, 87, 0.10)",
              lower: realPortfolio,
              upper: nominalPortfolio,
            }]
          : []),
      ]
    : undefined;

  const xLabels = isMonthly
    ? Array.from({ length: 13 }, (_, i) => `M${i}`)
    : Array.from({ length: sliceN }, (_, i) => `Y${i}`);

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
          Evolução do patrimônio
          <DisplayModeBadge />
        </h3>
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
        {isReal && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "rgba(255, 200, 87, 0.6)" }} />
            Inflação (perda de poder de compra)
          </span>
        )}
        {bands && mc.data && (
          <span className="ml-auto text-[11px] text-ink-3">Banda p10–p90 · Monte Carlo {mc.data.portfolio.finalDistribution.length / 1000}k</span>
        )}
      </div>
    </div>
  );
}
