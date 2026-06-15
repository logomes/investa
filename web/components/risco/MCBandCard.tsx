"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { formatRsK } from "@/lib/format";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import type { MonteCarloResultOut, SimulationResultOut } from "@/lib/api-types";

type Props = {
  portfolio:  MonteCarloResultOut;
  benchmark:  SimulationResultOut;
  years:      number[];
  nTrajectories: number;
};

export function MCBandCard({ portfolio, benchmark, years, nTrajectories }: Props) {
  const series = [
    { name: `${portfolio.label} p50`, color: portfolio.color, values: portfolio.p50, width: 2 },
    { name: benchmark.label, color: benchmark.color, values: benchmark.patrimony, width: 2 },
  ];
  const bands = [
    {
      name: `${portfolio.label} p10–p90`,
      color: "rgba(39, 174, 96, 0.18)",
      lower: portfolio.p10,
      upper: portfolio.p90,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-ink">Banda de patrimônio (p10–p90)</h3>
            <DisplayModeBadge />
          </div>
          <span className="text-[10px] text-ink-3">
            {nTrajectories.toLocaleString("pt-BR")} trajetórias
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <LineChart
          series={series}
          bands={bands}
          xLabels={years.map(String)}
          height={320}
          yFormat={(v) => formatRsK(v)}
        />
        <p className="text-[10px] text-ink-4 mt-3">
          Linha verde = p50 (mediano); sombra = intervalo p10–p90 (80% das trajetórias); linha amarela = benchmark determinístico. Seed fixa.
        </p>
      </CardContent>
    </Card>
  );
}
