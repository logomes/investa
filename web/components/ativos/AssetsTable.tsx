"use client";

import { useState } from "react";
import { Plus, Upload, Download, Pencil, Trash2, RefreshCw, Loader2, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { positionValueBRL, unrealizedGain } from "@/lib/ativos-derive";
import { ASSET_CLASS_META } from "@/lib/ativos-schema";
import type { AssetPosition } from "@/lib/ativos-schema";
import type { MacroOut } from "@/lib/api-types";
import { formatRs, formatPercent } from "@/lib/format";
import { relativeTime } from "@/lib/relative-time";

type Props = {
  positions: AssetPosition[];
  macro: MacroOut;
  onAdd: () => void;
  onEdit: (p: AssetPosition) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onImportB3: () => void;
  onExport: () => void;
  onRefreshQuote: (p: AssetPosition) => Promise<void>;
};

function formatNative(currency: string, value: number): string {
  const symbol = currency === "USD" ? "$" : "R$";
  return `${symbol} ${value.toFixed(2).replace(".", ",")}`;
}

export function AssetsTable({ positions, macro, onAdd, onEdit, onDelete, onImport, onImportB3, onExport, onRefreshQuote }: Props) {
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  async function handleRefresh(p: AssetPosition) {
    setRefreshing((r) => ({ ...r, [p.id]: true }));
    try {
      await onRefreshQuote(p);
    } finally {
      setRefreshing((r) => ({ ...r, [p.id]: false }));
    }
  }

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
            <Button variant="outline" size="sm" onClick={onImportB3}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Importar B3
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
          <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[840px] text-[12px]">
            <thead>
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2">Ticker</th>
                <th className="text-left font-normal py-2 px-2">Classe</th>
                <th className="text-right font-normal py-2 px-2">Moeda</th>
                <th className="text-right font-normal py-2 px-2">Qty</th>
                <th className="text-right font-normal py-2 px-2">Preço médio</th>
                <th className="text-right font-normal py-2 px-2">Preço atual</th>
                <th className="text-right font-normal py-2 px-2">Valor (BRL)</th>
                <th className="text-right font-normal py-2 px-2">Ganho atual</th>
                <th className="text-right font-normal py-2 px-2">DY esp.</th>
                <th className="text-right font-normal py-2 pl-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const meta = ASSET_CLASS_META[p.assetClass];
                const valueBRL = positionValueBRL(p, macro);
                const gain = unrealizedGain(p, macro);
                const isRefreshing = !!refreshing[p.id];
                const currentBRL = p.currentPrice && p.currency === "USD"
                  ? p.currentPrice * macro.usdBrl
                  : p.currentPrice;
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
                      {formatNative(p.currency, p.avgPrice)}
                    </td>
                    <td className="text-right py-2 px-2 tabular">
                      {p.currentPrice && currentBRL ? (
                        <div className="leading-tight">
                          <div className="text-ink">{formatRs(currentBRL)}</div>
                          <div className="text-[10.5px] text-ink-3 flex items-center justify-end gap-1">
                            {p.currency === "USD" && <span>{formatNative("USD", p.currentPrice)} · </span>}
                            {p.asOf && <span>{relativeTime(p.asOf)}</span>}
                            <button
                              type="button"
                              aria-label={`Atualizar cotação ${p.ticker}`}
                              onClick={() => handleRefresh(p)}
                              disabled={isRefreshing}
                              className="p-0.5 hover:text-ink"
                            >
                              {isRefreshing
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RefreshCw className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Buscar cotação ${p.ticker}`}
                          onClick={() => handleRefresh(p)}
                          disabled={isRefreshing}
                          className="text-ink-3 hover:text-ink inline-flex items-center gap-1"
                        >
                          {isRefreshing
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RefreshCw className="w-3 h-3" />}
                          <span>Buscar</span>
                        </button>
                      )}
                    </td>
                    <td className="text-right py-2 px-2 tabular text-ink">{formatRs(valueBRL)}</td>
                    <td className="text-right py-2 px-2 tabular">
                      {gain ? (
                        <div className={`leading-tight ${gain.gainBRL >= 0 ? "text-brand-bright" : "text-accent-coral"}`}>
                          <div>{gain.gainBRL >= 0 ? "+" : ""}{formatRs(gain.gainBRL)}</div>
                          <div className="text-[10.5px] opacity-80">{gain.gainPct >= 0 ? "+" : ""}{formatPercent(gain.gainPct, 2)}</div>
                        </div>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
