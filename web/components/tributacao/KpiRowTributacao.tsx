"use client";

import { Receipt, Wallet, Percent, Scale } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { taxDelta } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  portfolio: TaxComparisonRowOut;
  benchmark: TaxComparisonRowOut;
};

export function KpiRowTributacao({ portfolio, benchmark }: Props) {
  const delta = taxDelta(portfolio, benchmark);
  const absDiff = Math.abs(delta.taxDiffAbs);
  const absBurden = Math.abs(delta.burdenDiffPp);
  const subDelta = delta.portfolioPaysMore
    ? `Carteira paga +${formatPercent(absBurden, 2)} a mais`
    : `Benchmark paga +${formatPercent(absBurden, 2)} a mais`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Imposto Carteira"
        value={formatRs(portfolio.annualTax)}
        icon={Wallet}
        sub="anual"
      />
      <KpiCard
        label="Imposto Benchmark"
        value={formatRs(benchmark.annualTax)}
        icon={Receipt}
        sub="anual"
      />
      <KpiCard
        label="Carga efetiva Carteira"
        value={formatPercent(portfolio.effectiveTaxBurden, 2)}
        icon={Percent}
        sub={`${formatPercent(benchmark.effectiveTaxBurden, 2)} benchmark`}
      />
      <KpiCard
        label="Diferença"
        value={formatRs(absDiff)}
        icon={Scale}
        feature
        valueColor={delta.portfolioPaysMore ? "red" : "green"}
        sub={subDelta}
      />
    </div>
  );
}
