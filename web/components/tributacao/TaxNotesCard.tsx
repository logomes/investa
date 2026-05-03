"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TAX_NOTES } from "@/lib/tributacao-derive";

export function TaxNotesCard() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">Notas tributárias 2026</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {TAX_NOTES.map((n) => (
            <li key={n.title} className="text-[12px]">
              <span className="font-semibold text-ink">{n.title}</span>
              <span className="text-ink-3"> — {n.body}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
