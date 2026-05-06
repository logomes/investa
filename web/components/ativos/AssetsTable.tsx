"use client";

import { Plus, Upload, Download, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { positionValueBRL } from "@/lib/ativos-derive";
import { ASSET_CLASS_META } from "@/lib/ativos-schema";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";
import { formatRs, formatPercent } from "@/lib/format";

type Props = {
  positions: AssetPosition[];
  macro: MacroOut;
  onAdd: () => void;
  onEdit: (p: AssetPosition) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
};

export function AssetsTable({ positions, macro, onAdd, onEdit, onDelete, onImport, onExport }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink">Posições</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onImport}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Importar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExport} disabled={positions.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV
            </Button>
            <Button size="sm" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Adicionar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-ink-3">Nenhuma posição registrada.</p>
            <p className="text-xs text-ink-4 mt-1">Adicione a primeira ou importe via CSV.</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2">Ticker</th>
                <th className="text-left font-normal py-2 px-2">Classe</th>
                <th className="text-right font-normal py-2 px-2">Moeda</th>
                <th className="text-right font-normal py-2 px-2">Qty</th>
                <th className="text-right font-normal py-2 px-2">Preço médio</th>
                <th className="text-right font-normal py-2 px-2">Valor (BRL)</th>
                <th className="text-right font-normal py-2 px-2">DY esp.</th>
                <th className="text-right font-normal py-2 pl-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const meta = ASSET_CLASS_META[p.assetClass];
                const valueBRL = positionValueBRL(p, macro);
                return (
                  <tr key={p.id} className="border-b border-line-soft last:border-b-0 hover:bg-bg-2/50">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-ink font-medium">{p.ticker}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-ink-2">{meta.label}</td>
                    <td className="text-right py-2 px-2 text-ink-3">{p.currency}</td>
                    <td className="text-right py-2 px-2 tabular text-ink-2">{p.quantity}</td>
                    <td className="text-right py-2 px-2 tabular text-ink-2">
                      {p.currency === "USD" ? "$" : "R$"} {p.avgPrice.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="text-right py-2 px-2 tabular text-ink">{formatRs(valueBRL)}</td>
                    <td className="text-right py-2 px-2 tabular text-ink-2">{formatPercent(p.expectedYield, 2)}</td>
                    <td className="text-right py-2 pl-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => onEdit(p)}
                          className="p-1 text-ink-3 hover:text-ink"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Excluir"
                          onClick={() => {
                            if (confirm(`Excluir ${p.ticker}?`)) onDelete(p.id);
                          }}
                          className="p-1 text-ink-3 hover:text-accent-coral"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
