"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { useDeflation } from "@/lib/use-deflation";
import { SCENARIO_COLORS } from "@/lib/tributacao-derive";
import { formatRsK } from "@/lib/format";

type Props = {
  taxPaidByYear: number[];
  exitTaxByYear: number[];
  years?: number[];
};

export function TaxTimelineChart({ taxPaidByYear, exitTaxByYear, years }: Props) {
  const { series: deflate } = useDeflation();

  const totalIfRedeemed = taxPaidByYear.map((v, i) => v + (exitTaxByYear[i] ?? 0));
  const path = deflate(taxPaidByYear);
  const total = deflate(totalIfRedeemed);

  const xLabels = (years ?? taxPaidByYear.map((_, i) => i)).map((y) => `Y${y}`);

  const lineSeries = [
    { name: "IR pago no caminho", color: SCENARIO_COLORS.tax, values: path, width: 2 },
    { name: "IR total se resgatar", color: SCENARIO_COLORS.tax, values: total, dash: "4 3", width: 1.5 },
  ];

  const bands = [
    {
      name: "IR de saída (latente)",
      color: "rgba(255, 93, 114, 0.14)",
      lower: path,
      upper: total,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
          Linha do tempo do IR
          <DisplayModeBadge />
        </h3>
      </CardHeader>
      <CardContent>
        <LineChart
          series={lineSeries}
          bands={bands}
          xLabels={xLabels}
          width={780}
          height={260}
          yFormat={(v) => formatRsK(v).replace("R$ ", "R$")}
        />
        <div className="flex items-center gap-4 mt-3 flex-wrap text-[11.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: SCENARIO_COLORS.tax }} />
            IR pago no caminho
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t border-dashed" style={{ borderColor: SCENARIO_COLORS.tax }} />
            IR total se resgatar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(255, 93, 114, 0.35)" }} />
            IR de saída (latente)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
