"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { byIrBracket } from "@/lib/fi-derive";
import { formatRs, formatPercent } from "@/lib/format";

export function IrRegressiveCard() {
  const positions = useFixedIncomeStore((s) => s.positions);
  const buckets = byIrBracket(positions, new Date());

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">IR regressivo</h3>
        <p className="text-[11px] text-ink-3 mt-0.5">tabela vigente</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[440px] text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold">
              <th className="text-left py-1 font-semibold">Prazo</th>
              <th className="text-right py-1 font-semibold">Alíquota</th>
              <th className="text-right py-1 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {buckets.map((b) => (
              <tr key={b.label} className="border-t border-line-soft">
                <td className="py-2">{b.label}</td>
                <td className="text-right tabular">{formatPercent(b.rate, 1)}</td>
                <td className="text-right tabular font-medium">
                  {b.total > 0 ? formatRs(b.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}
