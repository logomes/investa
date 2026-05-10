"use client";

import { Receipt, Wallet, Percent, Scale } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { taxDelta } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = {
  realEstate: TaxComparisonRowOut;
  portfolio:  TaxComparisonRowOut;
};

export function KpiRowTributacao({ realEstate, portfolio }: Props) {
  const delta = taxDelta(realEstate, portfolio);
  const absDiff = Math.abs(delta.taxDiffAbs);
  const absBurden = Math.abs(delta.burdenDiffPp);
  const subDelta = delta.realEstatePaysMore
    ? `Imóvel paga +${formatPercent(absBurden, 2)} a mais`
    : `Carteira paga +${formatPercent(absBurden, 2)} a mais`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Imposto Imóvel"
        value={formatRs(realEstate.annualTax)}
        icon={Receipt}
        valueColor="red"
        sub="anual"
      />
      <KpiCard
        label="Imposto Carteira"
        value={formatRs(portfolio.annualTax)}
        icon={Wallet}
        valueColor="green"
        sub="anual"
      />
      <KpiCard
        label="Carga efetiva Imóvel"
        value={formatPercent(realEstate.effectiveTaxBurden, 2)}
        icon={Percent}
        sub={`${formatPercent(portfolio.effectiveTaxBurden, 2)} carteira`}
      />
      <KpiCard
        label="Diferença"
        value={formatRs(absDiff)}
        icon={Scale}
        feature
        valueColor={delta.realEstatePaysMore ? "red" : "green"}
        sub={subDelta}
      />
    </div>
  );
}
