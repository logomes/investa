"use client";

import { TrendingUp, Wallet, Target, AlertTriangle } from "lucide-react";
import { useSimulate, useMonteCarlo } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { useDeflation } from "@/lib/use-deflation";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK, formatRs, formatPercent, formatSignedDelta } from "@/lib/format";

export function KpiRow() {
  const sim = useSimulate();
  const mc = useMonteCarlo();
  const goal = useScenarioStore((s) => s.goalTarget);
  const horizon = useScenarioStore((s) => s.scenario.horizon);
  const { isReal, at } = useDeflation();

  if (sim.isLoading || mc.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }
  if (sim.error || mc.error) {
    return <ErrorCard onRetry={() => { sim.refetch(); mc.refetch(); }} />;
  }

  const pf = sim.data!.portfolio;
  const lastIdx = pf.patrimony.length - 1;
  const pfFinalNominal = pf.patrimony[lastIdx];
  const pfFinal = at(pfFinalNominal, lastIdx);
  const pfInitial = pf.patrimony[0];
  const cagr = Math.pow(pfFinal / pfInitial, 1 / horizon) - 1;
  const monthlyIncomeFinal = at(pf.annualIncome[lastIdx], lastIdx) / 12;
  const monthlyIncomeInitial = pf.annualIncome[1] / 12;
  const monthlyDelta = monthlyIncomeFinal - monthlyIncomeInitial;

  const pfMc = mc.data!.portfolio;
  const probGoal = pfMc.finalDistribution.filter((v) => v >= goal).length / pfMc.finalDistribution.length;
  const drawdownAvg = pfMc.maxDrawdowns.reduce((a, b) => a + b, 0) / pfMc.maxDrawdowns.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label={`Patrimônio projetado · ${horizon}a`}
        value={formatRsK(pfFinal)}
        delta={{ value: formatSignedDelta(cagr, "percent"), dir: cagr >= 0 ? "up" : "down" }}
        sub={isReal
          ? `nominal ${formatRsK(pfFinalNominal)} · inflação consome ${formatRsK(pfFinalNominal - pfFinal)}`
          : "Cenário Carteira (mediana)"}
        icon={TrendingUp}
        feature
      />
      <KpiCard
        label="Renda mensal estimada"
        value={formatRs(monthlyIncomeFinal)}
        delta={{ value: formatSignedDelta(monthlyDelta, "currency") + " vs hoje", dir: monthlyDelta >= 0 ? "up" : "down" }}
        sub={`Ano ${horizon}`}
        icon={Wallet}
      />
      <KpiCard
        label="Probabilidade de meta"
        value={formatPercent(probGoal)}
        sub={`Monte Carlo · meta ${formatRsK(goal)}`}
        icon={Target}
        valueColor={probGoal >= 0.5 ? "green" : "default"}
      />
      <KpiCard
        label="Drawdown médio"
        value={formatPercent(-drawdownAvg)}
        sub="máx histórico simulado"
        icon={AlertTriangle}
        valueColor="red"
      />
    </div>
  );
}
