"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { useDeflation } from "@/lib/use-deflation";
import { TAX_PROFILE_LABEL } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxProjectionRowOut } from "@/lib/api-types";

type Props = { rows: TaxProjectionRowOut[]; horizon: number };

export function TributacaoTable({ rows, horizon }: Props) {
  const { at } = useDeflation();

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
          Detalhamento por classe
          <DisplayModeBadge />
        </h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[620px] text-[12px]">
            <thead>
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2">Classe</th>
                <th className="text-right font-normal py-2 px-2">IR no caminho</th>
                <th className="text-right font-normal py-2 px-2">IR na saída</th>
                <th className="text-right font-normal py-2 px-2">Líquido final</th>
                <th className="text-right font-normal py-2 pl-2">% do bruto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pctOfGross =
                  row.grossFinal > 0 ? (row.taxPaidPath + row.exitTax) / row.grossFinal : 0;
                return (
                  <tr key={row.name} className="border-b border-line-soft last:border-b-0">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-ink truncate">{row.name}</span>
                        <span className="inline-block rounded bg-bg-3 px-1.5 py-0.5 text-[10px] text-ink-3 flex-shrink-0">
                          {TAX_PROFILE_LABEL[row.taxProfile] ?? row.taxProfile}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2 tabular text-accent-coral">
                      {formatRs(at(row.taxPaidPath, horizon))}
                    </td>
                    <td className="text-right py-2 px-2 tabular text-accent-coral">
                      {formatRs(at(row.exitTax, horizon))}
                    </td>
                    <td className="text-right py-2 px-2 tabular text-accent-green">
                      {formatRs(at(row.netFinal, horizon))}
                    </td>
                    <td className="text-right py-2 pl-2 tabular text-ink-2">
                      {formatPercent(pctOfGross, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
