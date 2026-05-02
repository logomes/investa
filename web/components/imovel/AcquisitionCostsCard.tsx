"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { acquisitionCosts } from "@/lib/imovel-derive";
import { formatRs } from "@/lib/format";
import type { RealEstateInput } from "@/lib/api-types";

type Props = { re: RealEstateInput };

export function AcquisitionCostsCard({ re }: Props) {
  const items = acquisitionCosts(re);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Custos não-recorrentes</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.item} className="flex items-center justify-between border-b border-line-soft pb-2 last:border-b-0">
              <span className="text-[13px] text-ink">{it.item}</span>
              <span className="text-[13px] text-ink tabular">{formatRs(it.value)}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ink-4 mt-3">
          Reformas e mobília (R$ 5k–35k) ficam fora desta análise.
        </p>
      </CardContent>
    </Card>
  );
}
