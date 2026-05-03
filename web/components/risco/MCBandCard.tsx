"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { formatRsK } from "@/lib/format";
import type { MonteCarloResultOut } from "@/lib/api-types";

type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  years:      number[];
  nTrajectories: number;
};

export function MCBandCard({ realEstate, portfolio, years, nTrajectories }: Props) {
  const series = [
    { name: `${portfolio.label} p50`,  color: portfolio.color,  values: portfolio.p50,  width: 2 },
    { name: `${realEstate.label} p50`, color: realEstate.color, values: realEstate.p50, width: 2 },
  ];
  const bands = [
    {
      name: `${portfolio.label} p10–p90`,
      color: "rgba(39, 174, 96, 0.18)",
      lower: portfolio.p10,
      upper: portfolio.p90,
    },
    {
      name: `${realEstate.label} p10–p90`,
      color: "rgba(192, 57, 43, 0.14)",
      lower: realEstate.p10,
      upper: realEstate.p90,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Banda de patrimônio (p10–p90)</h3>
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
          Linha sólida = p50 (mediano); sombra = intervalo p10–p90 (80% das trajetórias). Seed fixa.
        </p>
      </CardContent>
    </Card>
  );
}
