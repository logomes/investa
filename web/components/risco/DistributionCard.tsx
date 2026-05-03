"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Histogram } from "./Histogram";
import { distributionPercentiles } from "@/lib/risco-derive";
import type { MonteCarloResultOut } from "@/lib/api-types";

type Props = {
  realEstate: MonteCarloResultOut;
  portfolio:  MonteCarloResultOut;
  target: number;
};

export function DistributionCard({ realEstate, portfolio, target }: Props) {
  const reP = distributionPercentiles(realEstate.finalDistribution);
  const pfP = distributionPercentiles(portfolio.finalDistribution);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Distribuição final do patrimônio</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-medium text-ink mb-2">{portfolio.label}</p>
            <Histogram
              values={portfolio.finalDistribution}
              color={portfolio.color}
              percentiles={pfP}
              target={target}
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-2">{realEstate.label}</p>
            <Histogram
              values={realEstate.finalDistribution}
              color={realEstate.color}
              percentiles={reP}
              target={target}
            />
          </div>
        </div>
        <p className="text-[10px] text-ink-4 mt-3">
          Cada barra agrupa trajetórias com patrimônio final no intervalo. Linhas tracejadas = p10/p50/p90;
          linha sólida amarela = meta (se setada).
        </p>
      </CardContent>
    </Card>
  );
}
