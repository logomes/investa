"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { useSimulate, useMonteCarlo, useMacro } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRs, formatPercent } from "@/lib/format";
import { totalReturn } from "@/lib/carteira-derive";
import { recommend, goalProbability } from "@/lib/goal-recommend";

export function GoalCard() {
  const sim = useSimulate();
  const mc = useMonteCarlo();
  const macro = useMacro();
  const goal = useScenarioStore((s) => s.goalTarget);
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const setGoalTarget = useScenarioStore((s) => s.setGoalTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoalTarget(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (sim.isLoading) return <ChartSkeleton height={420} />;
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const pf = sim.data!.portfolio;
  const current = pf.patrimony[pf.patrimony.length - 1];
  const today = pf.patrimony[0];
  const progress = Math.min(today / goal, 1);

  const rec = recommend({
    goal,
    capital: today,
    horizonYears: scenario.horizon,
    currentMonthlyContribution: scenario.portfolio.monthlyContribution,
    contributionInflationIndexed: scenario.portfolio.contributionInflationIndexed,
    totalReturnAnnualNet: totalReturn(scenario.portfolio),
    projectedFinalPatrimony: current,
    expectedInflation: macro.data?.ipca ?? 0.04,
  });

  const mcDist = mc.data?.portfolio.finalDistribution ?? [];
  const mcReady = !mc.isLoading && !mc.error && mcDist.length > 0;
  const probability = mcReady ? goalProbability(mcDist, goal) : null;

  const probabilityColor =
    probability === null
      ? "text-ink-3"
      : probability >= 0.7
        ? "text-brand-bright"
        : probability >= 0.4
          ? "text-accent-amber"
          : "text-accent-coral";

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5 flex flex-col h-[420px]">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-brand-bright" />
        <h3 className="text-[13.5px] font-semibold text-ink">Meta patrimonial</h3>
      </div>
      {editing ? (
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // commit() is idempotent — Enter triggers blur immediately after,
          // so it fires twice; setGoalTarget with same value is a no-op.
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          aria-label="Editar meta"
          className="text-[26px] font-bold text-ink tabular leading-none w-full bg-bg-3 border border-line rounded-md px-2 py-0.5"
        />
      ) : (
        <button
          type="button"
          aria-label="Editar meta"
          onClick={() => {
            setDraft(String(goal));
            setEditing(true);
          }}
          className="text-[26px] font-bold text-ink tabular leading-none cursor-pointer hover:text-brand-bright text-left"
        >
          {formatRs(goal)}
        </button>
      )}
      <p className="text-[12px] text-ink-3 mt-1">Hoje · {formatRs(today)}</p>

      <div className="mt-4">
        <div className="h-2 bg-bg-3 rounded-pill overflow-hidden">
          <div
            className="h-full rounded-pill transition-all"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #2af0c4 0%, #00b894 100%)",
            }}
          />
        </div>
        <p className="text-[11.5px] text-ink-3 mt-1">{formatPercent(progress)} da meta alocada</p>
        {probability !== null && (
          <p className={`text-[11.5px] mt-0.5 ${probabilityColor}`}>
            {formatPercent(probability)} provável de atingir em {scenario.horizon}a
          </p>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-line-soft">
        <p className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Recomendação investa AI</p>
        <RecommendationBlock
          rec={rec}
          horizonYears={scenario.horizon}
          currentMonthly={scenario.portfolio.monthlyContribution}
          ipcaIndexed={scenario.portfolio.contributionInflationIndexed}
          onApply={(suggested) => {
            const latest = useScenarioStore.getState().scenario;
            setScenario({
              ...latest,
              portfolio: { ...latest.portfolio, monthlyContribution: suggested },
            });
          }}
        />
      </div>
    </div>
  );
}

type RecBlockProps = {
  rec: ReturnType<typeof recommend>;
  horizonYears: number;
  currentMonthly: number;
  ipcaIndexed: boolean;
  onApply: (suggested: number) => void;
};

function RecommendationBlock({ rec, horizonYears, currentMonthly, ipcaIndexed, onApply }: RecBlockProps) {
  if (rec.state === "already-met") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          🎉 Meta atingida. Considere revisar para um valor mais ambicioso.
        </p>
      </div>
    );
  }
  if (rec.state === "already-on-track") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Aporte atual (<span className="text-ink font-semibold">{formatRs(currentMonthly)}/mês</span>) já é suficiente — projeção <span className="text-ink font-semibold">{formatRs(rec.projectedFinal)}</span> em {horizonYears}a.
        </p>
      </div>
    );
  }
  if (rec.state === "unreachable") {
    return (
      <div className="bg-bg-3 rounded-card p-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Meta improvável mesmo com aporte &gt; <span className="text-ink font-semibold">{formatRs(rec.suggestedMonthly)}/mês</span> — considere aumentar horizonte ou reduzir alvo.
        </p>
      </div>
    );
  }
  const applied = Math.abs(currentMonthly - rec.suggestedMonthly) < 1;
  return (
    <>
      <div className="bg-bg-3 rounded-card p-3 mb-3">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          Aporte de <span className="text-ink font-semibold">{formatRs(rec.suggestedMonthly)}/mês</span>{ipcaIndexed ? " indexado ao IPCA" : ""} para atingir a meta em {horizonYears}a.
        </p>
      </div>
      <button
        type="button"
        disabled={applied}
        onClick={() => onApply(rec.suggestedMonthly)}
        className="w-full text-[13px] font-semibold py-2 rounded-[10px] text-bg-0 shadow-glow hover:scale-[1.01] transition-transform disabled:opacity-60 disabled:hover:scale-100"
        style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
      >
        {applied ? "Sugestão aplicada ✓" : "Aplicar sugestão"}
      </button>
    </>
  );
}
