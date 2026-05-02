"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { REAL_ESTATE_RISKS } from "@/lib/imovel-derive";

export function RisksCard() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Riscos críticos</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {REAL_ESTATE_RISKS.map((r) => (
            <li key={r.title} className="text-[12px]">
              <span className="font-semibold text-ink">{r.title}</span>
              <span className="text-ink-3"> — {r.body}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
