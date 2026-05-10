"use client";

import { Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toCsvBR, csvFilename, type LongRow } from "@/lib/exportar-csv";
import { formatRs } from "@/lib/format";

type Props = {
  rows: LongRow[];
  horizonYears: number;
};

const SCENARIO_COLORS: Record<string, string> = {
  "Imóvel": "#FF6B5B",
  "Imóvel (financiado)": "#FF6B5B",
  "Carteira diversificada": "#46E8A4",
  "Tesouro Selic líquido": "#5CC8FF",
};

function bulletColor(scenario: string): string {
  return SCENARIO_COLORS[scenario] ?? "#7d9591";
}

function downloadCsv(rows: LongRow[], horizonYears: number) {
  const csv = toCsvBR(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename(horizonYears);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportPreviewCard({ rows, horizonYears }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink">
              Comparativo Imóvel × Carteira × Tesouro
            </h3>
            <p className="text-[11px] text-ink-3 mt-1">
              Long format · 3 cenários × {horizonYears + 1} anos = {rows.length} linhas
            </p>
          </div>
          <Button onClick={() => downloadCsv(rows, horizonYears)}>
            <Download className="w-4 h-4 mr-1.5" />
            Baixar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[440px] overflow-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[560px] text-[12px]">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2">Cenário</th>
                <th className="text-right font-normal py-2 px-2">Ano</th>
                <th className="text-right font-normal py-2 px-2">Patrimônio</th>
                <th className="text-right font-normal py-2 px-2">Renda Anual</th>
                <th className="text-right font-normal py-2 pl-2">Renda Acumulada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-line-soft last:border-b-0">
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
                  <td className="text-right py-2 px-2 tabular text-ink-2">{row.year}</td>
                  <td className="text-right py-2 px-2 tabular text-ink">{formatRs(row.patrimony)}</td>
                  <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs(row.annualIncome)}</td>
                  <td className="text-right py-2 pl-2 tabular text-ink-2">{formatRs(row.cumulativeIncome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
