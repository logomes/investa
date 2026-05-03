"use client";

import { AlertTriangle } from "lucide-react";
import type { LossRateInfo } from "@/lib/risco-derive";
import { formatRs, formatPercent } from "@/lib/format";

type Props = { info: LossRateInfo; capitalInitial: number };

export function LossRateBanner({ info, capitalInitial }: Props) {
  if (!info.show) return null;
  const flaggedText = info.flagged
    .map((f) => `${f.label} ${formatPercent(f.rate, 1)}`)
    .join("; ");

  return (
    <div className="flex items-start gap-2 bg-accent-amber/10 border border-accent-amber/40 rounded-card p-3">
      <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
      <p className="text-xs text-ink">
        Trajetórias com perda nominal abaixo de {formatRs(capitalInitial)} ao final do horizonte:{" "}
        <span className="font-semibold">{flaggedText}</span>. Considere reduzir alocação em ativos
        de alta σ ou ajustar o horizonte.
      </p>
    </div>
  );
}
