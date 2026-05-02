"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { formatRsK } from "@/lib/format";
import type { SimulationResultOut } from "@/lib/api-types";

type Props = { simulation: SimulationResultOut };

export function EvolutionCard({ simulation }: Props) {
  const series = [
    { name: "Patrimônio", color: "#46E8A4", values: simulation.patrimony, width: 2 },
  ];
  if (simulation.debtBalance && simulation.debtBalance.some((v) => v > 0)) {
    series.push({ name: "Saldo devedor", color: "#FF5D72", values: simulation.debtBalance, width: 1.5 });
  }
  if (simulation.internalPortfolio && simulation.internalPortfolio.length > 0) {
    series.push({ name: "Carteira interna", color: "#5CC8FF", values: simulation.internalPortfolio, width: 1.5 });
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Evolução do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <LineChart
          series={series}
          xLabels={simulation.years.map(String)}
          height={300}
          yFormat={(v) => formatRsK(v)}
        />
      </CardContent>
    </Card>
  );
}
