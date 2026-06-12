"use client";

import { useState, useEffect } from "react";
import { Target } from "lucide-react";
import { useSimulate, useMonteCarlo, useGoalSolve } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRs, formatPercent } from "@/lib/format";
import { totalReturn } from "@/lib/carteira-derive";
import { recommend, goalProbability } from "@/lib/goal-recommend";
import { deflationFactor } from "@/lib/deflate";
import { useDeflation } from "@/lib/use-deflation";

const SOLVE_CONFIDENCE = 0.8;
const SOLVE_TRAJECTORIES = 1500;

export function GoalCard() {
  const sim = useSimulate();
  const mc = useMonteCarlo();
  const goalSolve = useGoalSolve();
  const goal = useScenarioStore((s) => s.goalTarget);
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const setGoalTarget = useScenarioStore((s) => s.setGoalTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const { isReal, ipca, at } = useDeflation();
  // Goal is in active-mode money. Convert to nominal space for all engine inputs.
  // In real mode: nominalGoal = goal / deflationFactor(ipca, horizon)
  //             = goal * (1 + ipca)^horizon
  // In nominal mode: nominalGoal = goal (identity)
  const nominalGoal = isReal ? goal / deflationFactor(ipca, scenario.horizon) : goal;

  const { reset: resetGoalSolve } = goalSolve;
  useEffect(() => {
    resetGoalSolve();
  }, [goal, scenario, resetGoalSolve]);

  const handleSolve = () => {
    goalSolve.mutate({
      horizon: scenario.horizon,
      portfolio: scenario.portfolio,
      goalTarget: nominalGoal,
      confidence: SOLVE_CONFIDENCE,
      nTrajectories: SOLVE_TRAJECTORIES,
      expectedInflation: scenario.expectedInflation,
    });
  };

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

  if (sim.isLoading) return <ChartSkeleton height={480} />;
  if (sim.error) return <ErrorCard onRetry={() => sim.refetch()} />;

  const pf = sim.data!.portfolio;
  const current = pf.patrimony[pf.patrimony.length - 1];
  const today = pf.patrimony[0];
  const progress = Math.min(today / goal, 1);

  const rec = recommend({
    goal: nominalGoal,
    capital: today,
    horizonYears: scenario.horizon,
    currentMonthlyContribution: scenario.portfolio.monthlyContribution,
    contributionInflationIndexed: scenario.portfolio.contributionInflationIndexed,
    totalReturnAnnualNet: totalReturn(scenario.portfolio),
    projectedFinalPatrimony: current,
    expectedInflation: scenario.expectedInflation,
  });

  const mcDist = mc.data?.portfolio.finalDistribution ?? [];
  const mcReady = !mc.isLoading && !mc.error && mcDist.length > 0;
  const probability = mcReady ? goalProbability(mcDist, nominalGoal) : null;

  const probabilityColor =
    probability === null
      ? "text-ink-3"
      : probability >= 0.7
        ? "text-brand-bright"
        : probability >= 0.4
          ? "text-accent-amber"
          : "text-accent-coral";

  return (
    <div className="bg-bg-2 border border-line rounded-card p-5 flex flex-col h-[480px]">
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
      {isReal && <p className="text-[10px] text-ink-4">meta em R$ de hoje</p>}
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
          displayFinal={at(current, scenario.horizon)}
          onApply={(suggested) => {
            const latest = useScenarioStore.getState().scenario;
            setScenario({
              ...latest,
              portfolio: { ...latest.portfolio, monthlyContribution: suggested },
            });
          }}
        />
        <div className="mt-3">
          {goalSolve.data ? (
            goalSolve.data.attainable ? (
              <div className="bg-bg-3 rounded-card p-3 space-y-2">
                <p className="text-[12px] text-ink-2 leading-relaxed">
                  Monte Carlo: <span className="text-ink font-semibold">{formatRs(goalSolve.data.requiredMonthlyContribution)}/mês</span>{" "}
                  para {formatPercent(SOLVE_CONFIDENCE)} de confiança (P={formatPercent(goalSolve.data.achievedProbability)}).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const latest = useScenarioStore.getState().scenario;
                    setScenario({
                      ...latest,
                      portfolio: {
                        ...latest.portfolio,
                        monthlyContribution: goalSolve.data!.requiredMonthlyContribution,
                      },
                    });
                  }}
                  className="w-full text-[12px] font-semibold py-1.5 rounded-[10px] text-bg-0 shadow-glow hover:scale-[1.01] transition-transform"
                  style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
                >
                  Aplicar aporte refinado
                </button>
              </div>
            ) : (
              <p className="text-[11.5px] text-accent-coral">
                Meta improvável mesmo com {formatRs(goalSolve.data.requiredMonthlyContribution)}/mês — aumente horizonte ou reduza o alvo.
              </p>
            )
          ) : (
            <button
              type="button"
              onClick={handleSolve}
              disabled={goalSolve.isPending}
              className="w-full text-[12px] font-medium py-1.5 rounded-[10px] border border-line text-ink-2 hover:text-ink disabled:opacity-60"
            >
              {goalSolve.isPending ? "Calculando (Monte Carlo)… ~10s" : "Refinar com Monte Carlo"}
            </button>
          )}
          {goalSolve.isError && (
            <p className="text-[11px] text-accent-coral mt-1">
              Falha ao calcular — <button type="button" className="underline" onClick={handleSolve}>tentar de novo</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type RecBlockProps = {
  rec: ReturnType<typeof recommend>;
  horizonYears: number;
  currentMonthly: number;
  ipcaIndexed: boolean;
  /** Projected final patrimony in active display mode (nominal or real). */
  displayFinal: number;
  onApply: (suggested: number) => void;
};

function RecommendationBlock({ rec, horizonYears, currentMonthly, ipcaIndexed, displayFinal, onApply }: RecBlockProps) {
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
          Aporte atual (<span className="text-ink font-semibold">{formatRs(currentMonthly)}/mês</span>) já é suficiente — projeção <span className="text-ink font-semibold">{formatRs(displayFinal)}</span> em {horizonYears}a.
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
