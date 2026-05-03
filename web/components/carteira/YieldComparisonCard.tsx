"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { yieldComparison, yieldRefLines } from "@/lib/carteira-derive";
import { formatPercent } from "@/lib/format";
import type { PortfolioInput, RealEstateInput, MacroOut } from "@/lib/api-types";

type Props = {
  pf: PortfolioInput;
  re: RealEstateInput;
  benchmarkTaxRate: number;
  macro: MacroOut;
};

export function YieldComparisonCard({ pf, re, benchmarkTaxRate, macro }: Props) {
  const rows = yieldComparison({ pf, re, benchmarkTaxRate, macro });
  const refs = yieldRefLines(macro);
  const allValues = [...rows.map((r) => r.value), ...refs.map((r) => r.value)];
  const xMax = Math.max(...allValues, 0.01) + 0.02;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Comparativo de yields</h3>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-2 pt-6 pb-2">
          <div className="absolute inset-x-[160px] top-0 bottom-2 pointer-events-none">
            {refs.map((ref) => {
              const left = (ref.value / xMax) * 100;
              return (
                <div
                  key={ref.label}
                  className="absolute top-0 bottom-0 border-l border-dashed border-ink-4/60"
                  style={{ left: `${left}%` }}
                >
                  <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-ink-3 whitespace-nowrap">
                    {ref.label} {formatPercent(ref.value, 2)}
                  </span>
                </div>
              );
            })}
          </div>

          {rows.map((row) => {
            const width = (row.value / xMax) * 100;
            return (
              <div key={row.label} className="grid grid-cols-[160px_1fr_70px] items-center gap-2 h-7 relative">
                <span className="text-[12px] text-ink truncate">{row.label}</span>
                <div className="h-2.5 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: row.color }}
                  />
                </div>
                <span className="text-[12px] text-ink tabular text-right">{formatPercent(row.value, 2)}</span>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-ink-4 mt-3">
          Linhas tracejadas = referência macro atual.
        </p>
      </CardContent>
    </Card>
  );
}
