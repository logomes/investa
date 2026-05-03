"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SensitivityRow } from "@/lib/sensibilidade-derive";
import { formatRs, formatRsK } from "@/lib/format";

type Props = { rows: SensitivityRow[] };

export function SensibilidadeTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento</h3>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Parâmetro</th>
              <th className="text-right font-normal py-2 px-2">Pessimista</th>
              <th className="text-right font-normal py-2 px-2">Base</th>
              <th className="text-right font-normal py-2 px-2">Otimista</th>
              <th className="text-right font-normal py-2 pl-2">Amplitude</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pessClass = row.pessimistic < row.base ? "text-accent-coral" : "text-accent-green";
              const optClass  = row.optimistic  < row.base ? "text-accent-coral" : "text-accent-green";
              return (
                <tr key={row.parameter} className="border-b border-line-soft last:border-b-0">
                  <td className="py-2 pr-2 text-ink">{row.label}</td>
                  <td className={`text-right py-2 px-2 tabular ${pessClass}`}>{formatRs(row.pessimistic)}</td>
                  <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.base)}</td>
                  <td className={`text-right py-2 px-2 tabular ${optClass}`}>{formatRs(row.optimistic)}</td>
                  <td className="text-right py-2 pl-2 tabular text-ink-2">{formatRsK(row.amplitude)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
