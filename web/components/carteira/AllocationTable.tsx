"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { allocationSegments } from "@/lib/carteira-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function AllocationTable({ pf }: Props) {
  const segments = allocationSegments(pf);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento por classe</h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[480px] text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Classe</th>
              <th className="text-right font-normal py-2 px-2">Peso</th>
              <th className="text-right font-normal py-2 px-2">Valor</th>
              <th className="text-right font-normal py-2 px-2">Yield esp.</th>
              <th className="text-right font-normal py-2 pl-2">IR</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg.name} className="border-b border-line-soft last:border-b-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-ink truncate">{seg.name}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 tabular text-ink-2">{formatPercent(seg.weight, 1)}</td>
                <td className="text-right py-2 px-2 tabular text-ink">{formatRs(seg.amount)}</td>
                <td className="text-right py-2 px-2 tabular text-ink-2">{formatPercent(seg.expectedYield, 2)}</td>
                <td className="text-right py-2 pl-2 tabular text-ink-3">{formatPercent(seg.taxRate, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}
