"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { calendarByYear, totalAllocated } from "@/lib/fi-derive";
import { formatRsK } from "@/lib/format";

export function MaturityCalendarCard() {
  const positions = useFixedIncomeStore((s) => s.positions);
  const cal = calendarByYear(positions);
  const total = totalAllocated(positions);

  const dated = cal.filter((c) => c.year !== 0);
  const noMaturity = cal.find((c) => c.year === 0);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Calendário de vencimentos</h3>
      </CardHeader>
      <CardContent>
        {cal.length === 0 ? (
          <p className="text-sm text-ink-3 py-4 text-center">Sem posições</p>
        ) : (
          <div className="space-y-3">
            {dated.map((c) => {
              const pct = total > 0 ? c.totalAtMaturity / total : 0;
              return (
                <div key={c.year}>
                  <div className="flex items-baseline justify-between text-[12px] mb-1">
                    <div>
                      <span className="font-semibold text-ink tabular">{c.year}</span>{" "}
                      <span className="text-ink-3">
                        {c.items.map((i) => i.name.split(" ").slice(0, 2).join(" ")).join(", ")}
                      </span>
                    </div>
                    <span className="text-ink-2 tabular font-medium">
                      {formatRsK(c.totalAtMaturity)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg-3 rounded-pill overflow-hidden">
                    <div
                      className="h-full bg-brand-bright rounded-pill"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {noMaturity && (
              <div className="pt-3 border-t border-line-soft">
                <p className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-1">
                  Sem vencimento
                </p>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-ink-3">
                    {noMaturity.items.map((i) => i.name).join(", ")}
                  </span>
                  <span className="text-ink-2 tabular font-medium">
                    {formatRsK(noMaturity.totalAtMaturity)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
