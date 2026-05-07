"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { useSimulate } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRs, formatPercent } from "@/lib/format";

export function GoalCard() {
  const sim = useSimulate();
  const goal = useScenarioStore((s) => s.goalTarget);
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
  const progress = Math.min(current / goal, 1);

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
      <p className="text-[12px] text-ink-3 mt-1">Hoje · {formatRs(current)}</p>

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
        <p className="text-[11.5px] text-ink-3 mt-1">{formatPercent(progress)} provável</p>
      </div>

      <div className="mt-auto pt-4 border-t border-line-soft">
        <p className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Recomendação investa AI</p>
        <div className="bg-bg-3 rounded-card p-3 mb-3">
          <p className="text-[12px] text-ink-2 leading-relaxed">
            Aporte de <span className="text-ink font-semibold">R$ 800/mês</span> indexado ao IPCA eleva probabilidade de meta para <span className="text-brand-bright font-semibold">91%</span>.
          </p>
        </div>
        <button
          type="button"
          className="w-full text-[13px] font-semibold py-2 rounded-[10px] text-bg-0 shadow-glow hover:scale-[1.01] transition-transform"
          style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
        >
          Aplicar sugestão
        </button>
      </div>
    </div>
  );
}
