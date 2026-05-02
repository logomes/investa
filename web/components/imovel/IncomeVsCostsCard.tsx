"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { incomeWaterfall, grossAnnualRent } from "@/lib/imovel-derive";
import { formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function IncomeVsCostsCard({ re }: Props) {
  const items = incomeWaterfall(re);
  const max = Math.max(grossAnnualRent(re), 1);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Receita × Custos (anual)</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 items-end h-[180px]">
          {items.map((it) => {
            const height = Math.max(8, (Math.abs(it.value) / max) * 140);
            const color =
              it.type === "start"     ? "bg-accent-cyan"
              : it.type === "end"     ? "bg-accent-green"
              :                          "bg-accent-coral";
            const valueColor =
              it.type === "deduction" ? "text-accent-coral" : "text-ink";
            return (
              <div key={it.label} className="flex flex-col items-center justify-end gap-1.5 h-full">
                <span className={`text-[11px] tabular ${valueColor}`}>
                  {it.type === "deduction" ? "−" : ""}{formatRs(Math.abs(it.value))}
                </span>
                <div className={`${color} w-full rounded-t-sm`} style={{ height: `${height}px` }} />
                <span className="text-[10px] text-ink-3 text-center leading-tight">{it.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
