"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCENARIO_COLORS } from "@/lib/tributacao-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { TaxComparisonRowOut } from "@/lib/api-types";

type Props = { rows: TaxComparisonRowOut[] };

function bulletColor(scenario: string): string {
  if (scenario === "Carteira Diversificada") return SCENARIO_COLORS.portfolio;
  return SCENARIO_COLORS.realEstate;
}

export function TributacaoTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Detalhamento</h3>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[600px] text-[12px]">
          <thead>
            <tr className="text-ink-3 border-b border-line-soft">
              <th className="text-left font-normal py-2 pr-2">Cenário</th>
              <th className="text-right font-normal py-2 px-2">Receita Bruta</th>
              <th className="text-right font-normal py-2 px-2">Imposto Anual</th>
              <th className="text-right font-normal py-2 px-2">Receita Líquida</th>
              <th className="text-right font-normal py-2 pl-2">Carga Efetiva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scenario} className="border-b border-line-soft last:border-b-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: bulletColor(row.scenario) }}
                    />
                    <span className="text-ink truncate">{row.scenario}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.grossIncome)}</td>
                <td className="text-right py-2 px-2 tabular text-accent-coral">{formatRs(row.annualTax)}</td>
                <td className="text-right py-2 px-2 tabular text-accent-green">{formatRs(row.netIncome)}</td>
                <td className="text-right py-2 pl-2 tabular text-ink-2">{formatPercent(row.effectiveTaxBurden, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}
