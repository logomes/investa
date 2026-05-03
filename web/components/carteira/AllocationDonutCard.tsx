"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { allocationSegments, donutSlices } from "@/lib/carteira-derive";
import { formatRsK, formatPercent } from "@/lib/format";
import type { PortfolioInput } from "@/lib/api-types";

type Props = { pf: PortfolioInput };

export function AllocationDonutCard({ pf }: Props) {
  const segments = allocationSegments(pf);
  const slices = donutSlices({ segments, cx: 140, cy: 140, outerR: 110, innerR: 70 });

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Alocação por classe</h3>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <svg width={280} height={280} viewBox="0 0 280 280" role="img" aria-label="Alocação da carteira">
            {slices.map((slice, i) => (
              <path key={i} d={slice.path} fill={slice.color} />
            ))}
            <text x={140} y={138} textAnchor="middle" fontSize={22} fontWeight={700} fill="#eaf6f4">
              {formatRsK(pf.capital)}
            </text>
            <text x={140} y={156} textAnchor="middle" fontSize={11} fill="#7d9591">
              alocados
            </text>
          </svg>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
            {segments.map((seg) => (
              <div key={seg.name} className="flex items-center gap-2 text-[11px]">
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-ink truncate flex-1">{seg.name}</span>
                <span className="text-ink-3 tabular">{formatPercent(seg.weight, 1)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
