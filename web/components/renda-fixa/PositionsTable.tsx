"use client";

import { Plus, Upload } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMacro } from "@/lib/api";
import { effectiveAnnualRate, applicableIrRate } from "@/lib/fi-derive";
import { formatRs, formatPercent } from "@/lib/format";
import type { FixedIncomePosition } from "@/lib/fi-schema";

const INDEXER_LABELS: Record<string, string> = {
  prefixado: "PRÉ",
  cdi: "CDI",
  selic: "SELIC",
  ipca: "IPCA",
};

const INDEXER_COLORS: Record<string, string> = {
  prefixado: "bg-accent-amber/15 text-accent-amber",
  cdi: "bg-accent-cyan/15 text-accent-cyan",
  selic: "bg-brand-bright/15 text-brand-bright",
  ipca: "bg-accent-coral/15 text-accent-coral",
};

function formatRate(p: FixedIncomePosition): string {
  switch (p.indexer) {
    case "prefixado":
      return `${(p.rate * 100).toFixed(2).replace(".", ",")}%`;
    case "cdi":
      return `${(p.rate * 100).toFixed(0)}% CDI`;
    case "selic":
      return `Selic + ${(p.rate * 100).toFixed(2).replace(".", ",")}%`;
    case "ipca":
      return `IPCA + ${(p.rate * 100).toFixed(2).replace(".", ",")}%`;
  }
}

function formatMaturity(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

type Props = {
  positions: FixedIncomePosition[];
  onAdd: () => void;
  onEdit: (p: FixedIncomePosition) => void;
  onImportCsv: () => void;
};

export function PositionsTable({ positions, onAdd, onEdit, onImportCsv }: Props) {
  const macro = useMacro();
  const today = new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-[13.5px] font-semibold text-ink">Títulos em carteira</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onImportCsv}>
            <Upload className="w-4 h-4 mr-1.5" />
            Importar CSV
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="py-12 text-center text-ink-3 text-sm">
            Nenhuma posição cadastrada — clique em <span className="text-ink font-medium">+ Adicionar</span> ou importe um CSV.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Indexador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">IR</TableHead>
                <TableHead className="text-right">Líquido a.a.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => {
                const ir = applicableIrRate(p, today);
                const grossYield = macro.data ? effectiveAnnualRate(p, macro.data) : 0;
                const netYield = grossYield * (1 - ir);
                return (
                  <TableRow key={p.id} onClick={() => onEdit(p)} className="cursor-pointer">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${INDEXER_COLORS[p.indexer]}`}>
                        {INDEXER_LABELS[p.indexer]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatRs(p.initialAmount)}</TableCell>
                    <TableCell>{formatRate(p)}</TableCell>
                    <TableCell>{formatMaturity(p.maturityDate)}</TableCell>
                    <TableCell className="text-right tabular">{formatPercent(ir, 1)}</TableCell>
                    <TableCell className="text-right tabular font-semibold text-brand-bright">
                      {formatPercent(netYield, 2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
