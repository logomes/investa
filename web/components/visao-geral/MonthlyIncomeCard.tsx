"use client";

import { useSimulate } from "@/lib/api";
import { useDeflation } from "@/lib/use-deflation";
import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK } from "@/lib/format";

export function MonthlyIncomeCard() {
  const sim = useSimulate();
  const { series: deflate } = useDeflation();

  if (sim.isLoading) {
    return (
      <div className="bg-bg-2 border border-line rounded-card p-5">
        <h3 className="text-[13.5px] font-semibold text-ink mb-3">Renda mensal projetada</h3>
        <ChartSkeleton height={170} width={520} />
      </div>
    );
  }
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const data = sim.data!;
  const series = [
    { name: data.portfolio.label, color: data.portfolio.color, values: deflate(data.portfolio.annualIncome).map((v) => v / 12) },
    { name: data.benchmark.label, color: data.benchmark.color, values: deflate(data.benchmark.annualIncome).map((v) => v / 12) },
  ];
  const xLabels = data.portfolio.years.map((y) => `Y${y}`);

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5">
      <h3 className="text-[13.5px] font-semibold text-ink mb-3 flex items-center gap-2">
        Renda mensal projetada
        <DisplayModeBadge />
      </h3>
      <LineChart series={series} xLabels={xLabels} width={520} height={170} yFormat={(v) => formatRsK(v * 12)} />
      <p className="text-[11.5px] text-ink-3 mt-2">Carteira vs Benchmark · valor em R$/mês</p>
    </div>
  );
}
