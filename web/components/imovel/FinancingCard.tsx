"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/LineChart";
import { KpiCard } from "@/components/kpi/KpiCard";
import { financingSummary } from "@/lib/imovel-derive";
import { formatRs, formatRsK } from "@/lib/format";
import type { RealEstateInput, SimulationResultOut } from "@/lib/api-types";

type Props = {
  re: RealEstateInput;
  simulation: SimulationResultOut;
};

export function FinancingCard({ re, simulation }: Props) {
  const summary = financingSummary(re);
  if (!summary) return null;

  const debtBalance = simulation.debtBalance ?? [];
  const internalPortfolio = simulation.internalPortfolio ?? [];
  const negative = internalPortfolio.length > 0 && Math.min(...internalPortfolio) < 0;
  const negativeYear = negative
    ? simulation.years[internalPortfolio.findIndex((v) => v < 0)]
    : null;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Financiamento</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Entrada" value={formatRs(summary.entry)} sub={`${(re.financing!.entryPct * 100).toFixed(0)}% do imóvel`} />
          <KpiCard label="Parcela inicial" value={formatRs(summary.firstPayment)} sub={summary.systemLabel} />
          <KpiCard label="Total de juros" value={formatRsK(summary.totalInterest)} sub={`prazo ${summary.termYears} anos`} />
          <KpiCard label="Principal" value={formatRsK(summary.loanPrincipal)} sub="financiado" />
        </div>

        {negative && (
          <div className="flex items-start gap-2 bg-accent-amber/10 border border-accent-amber/40 rounded-card p-3">
            <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink">
              Carteira interna fica deficitária a partir do ano {negativeYear}. Em vida real, exigiria
              injeção de capital externo. Considere aumentar entrada, prazo, ou o aluguel-alvo.
            </p>
          </div>
        )}

        {debtBalance.length > 0 && (
          <div>
            <h4 className="text-[12px] text-ink-3 mb-2">Saldo devedor ano a ano</h4>
            <LineChart
              series={[{ name: "Saldo devedor", color: "#FF5D72", values: debtBalance }]}
              xLabels={simulation.years.map(String)}
              height={200}
              yFormat={(v) => formatRsK(v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
