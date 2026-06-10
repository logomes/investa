"use client";

import { useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRsK, formatRs, formatPercent } from "@/lib/format";

export function ComparativoTable() {
  const sim = useSimulate();
  const horizon = useScenarioStore((s) => s.scenario.horizon);

  if (sim.isLoading) return <ChartSkeleton height={220} />;
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const d = sim.data!;
  const finalIdx = d.portfolio.years.length - 1;

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13.5px] font-semibold text-ink">Comparativo final · ano {horizon}</h3>
        <span className="text-[11px] text-ink-3">cenário base</span>
      </div>
      <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full min-w-[440px] text-[13px]">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            <th className="text-left py-2 font-semibold">Cenário</th>
            <th className="text-right py-2 font-semibold">Yield</th>
            <th className="text-right py-2 font-semibold">Patrimônio</th>
            <th className="text-right py-2 font-semibold">Renda/mês</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {[d.portfolio, d.benchmark].map((s) => {
            const final = s.patrimony[finalIdx];
            const yieldFinal = (s.annualIncome[finalIdx] / final) || 0;
            const monthly = s.annualIncome[finalIdx] / 12;
            return (
              <tr key={s.label} className="border-t border-line-soft">
                <td className="py-2.5">
                  <span
                    className="inline-flex items-center gap-2 px-2 py-0.5 rounded-pill text-[11.5px] font-semibold"
                    style={{ background: `${s.color}22`, color: s.color }}
                  >
                    {s.label}
                  </span>
                </td>
                <td className="text-right tabular py-2.5">{formatPercent(yieldFinal)}</td>
                <td className="text-right tabular py-2.5 font-semibold">{formatRsK(final)}</td>
                <td className="text-right tabular py-2.5">{formatRs(monthly)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
