"use client";

import { useMemo, useState } from "react";
import { Wallet, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";
import { planContribution, type ContributionStrategy } from "@/lib/contribution-optimizer";
import { formatRs2, formatPercent } from "@/lib/format";

type Props = {
  positions: AssetPosition[];
  macro: MacroOut;
};

const STRATEGY_LABEL: Record<ContributionStrategy, string> = {
  balanced: "Equilibrar (peso igual entre classes)",
  preserve: "Preservar pesos atuais (DCA)",
};

export function ContributionPlanner({ positions, macro }: Props) {
  const [aporte, setAporte] = useState<string>("1000");
  const [strategy, setStrategy] = useState<ContributionStrategy>("balanced");

  const plan = useMemo(
    () => planContribution(positions, macro, Number(aporte) || 0, strategy),
    [positions, macro, aporte, strategy],
  );

  if (positions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand-bright" />
          <h3 className="text-[13.5px] font-semibold text-ink">Próximo aporte</h3>
        </div>
        <p className="text-[11.5px] text-ink-3 mt-1">
          Distribui o aporte entre as classes pra puxar a carteira na direção do alvo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[160px]">
            <label htmlFor="aporte-input" className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold block mb-1">
              Quanto vai aportar (R$)
            </label>
            <input
              id="aporte-input"
              type="number"
              min={0}
              step={100}
              value={aporte}
              onChange={(e) => setAporte(e.target.value)}
              className="w-full bg-bg-3 border border-line rounded-md text-[14px] text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-bright/40"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="strategy-select" className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold block mb-1">
              Estratégia
            </label>
            <select
              id="strategy-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as ContributionStrategy)}
              className="w-full bg-bg-3 border border-line rounded-md text-[13px] text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-bright/40"
            >
              {(Object.keys(STRATEGY_LABEL) as ContributionStrategy[]).map((k) => (
                <option key={k} value={k}>{STRATEGY_LABEL[k]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Classe</th>
              <th className="text-right font-normal py-2 px-2">Atual</th>
              <th className="text-right font-normal py-2 px-2">Alvo</th>
              <th className="text-right font-normal py-2 px-2">Gap</th>
              <th className="text-right font-normal py-2 pl-2">Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {plan.byClass.map((c) => {
              const gapPositive = c.gapPct > 0;
              return (
                <tr key={c.assetClass} className="border-b border-line-soft last:border-b-0">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-ink">{c.label}</span>
                    </div>
                  </td>
                  <td className="text-right tabular py-2 px-2 text-ink-2">{formatPercent(c.currentPct, 1)}</td>
                  <td className="text-right tabular py-2 px-2 text-ink-2">{formatPercent(c.targetPct, 1)}</td>
                  <td className={`text-right tabular py-2 px-2 ${gapPositive ? "text-brand-bright" : "text-ink-3"}`}>
                    {gapPositive ? "+" : ""}{formatPercent(c.gapPct, 1)}
                  </td>
                  <td className="text-right tabular py-2 pl-2 font-semibold text-ink">
                    {c.suggestedR$ > 0.5 ? formatRs2(c.suggestedR$) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-soft text-[11.5px] text-ink-3">
          <Repeat className="w-3.5 h-3.5" />
          <span>
            Carteira passa de {formatRs2(plan.totalCurrentBRL)} pra {formatRs2(plan.totalProjectedBRL)} após o aporte.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
