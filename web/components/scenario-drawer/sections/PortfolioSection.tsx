"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, Download } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PortfolioAssetDialog } from "../PortfolioAssetDialog";
import { assignColor, MAX_PORTFOLIO_ASSETS } from "@/lib/portfolio-asset-types";
import { DEFAULT_SCENARIO } from "@/lib/defaults";
import type { PortfolioAssetInput } from "@/lib/api-types";
import { formatPercent, formatRs } from "@/lib/format";
import { useMacro } from "@/lib/api";
import { useAssetsStore } from "@/lib/ativos-store";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { useScenarioStore } from "@/lib/store";
import { bridgePortfolio, type BridgeResult } from "@/lib/portfolio-bridge";

type DialogState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; index: number };

export function PortfolioSection() {
  const { register, control, formState, setValue, getValues } = useFormContext<ScenarioFormValues>();
  const { fields, append, remove, update, replace } = useFieldArray({ control, name: "portfolio.assets" });
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const macro = useMacro();
  const realPositions = useAssetsStore((s) => s.positions);
  const fiPositions = useFixedIncomeStore((s) => s.positions);
  const lastRealImportAt = useScenarioStore((s) => s.lastRealImportAt);
  const setLastRealImportAt = useScenarioStore((s) => s.setLastRealImportAt);
  const [preview, setPreview] = useState<BridgeResult | null>(null);

  const canImport =
    !!macro.data && (realPositions.length > 0 || fiPositions.length > 0);

  const handlePreviewImport = () => {
    if (!macro.data) return;
    const current = getValues();
    const result = bridgePortfolio({
      positions: realPositions,
      fiPositions,
      macro: macro.data,
      monthlyContribution: current.portfolio.monthlyContribution,
      contributionInflationIndexed: current.portfolio.contributionInflationIndexed,
    });
    setPreview(result);
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    replace(preview.portfolio.assets);
    setValue("portfolio.capital", preview.portfolio.capital, { shouldDirty: true });
    setValue("capital", preview.portfolio.capital, { shouldDirty: true });
    setLastRealImportAt(new Date().toISOString());
    setPreview(null);
  };

  const assets = useWatch({ control, name: "portfolio.assets" });
  const sum = assets.reduce((acc, a) => acc + (a.weight || 0), 0);
  const sumOk = Math.abs(sum - 1) <= 0.001;
  const portfolioError = (formState.errors.portfolio as { message?: string } | undefined)?.message;

  const handleAdd = () => setDialog({ open: true, mode: "add" });
  const handleEdit = (index: number) => setDialog({ open: true, mode: "edit", index });

  const handleSubmit = (asset: PortfolioAssetInput) => {
    if (dialog.open && dialog.mode === "edit") {
      update(dialog.index, asset);
    } else {
      append(asset);
    }
    setDialog({ open: false });
  };

  const handleDeleteFromDialog = () => {
    if (dialog.open && dialog.mode === "edit") {
      remove(dialog.index);
    }
  };

  const handleRowDelete = (index: number, name: string) => {
    if (confirm(`Excluir ${name}?`)) remove(index);
  };

  const handleReset = () => {
    if (confirm("Restaurar 5 ativos padrão? Mudanças serão perdidas.")) {
      replace(DEFAULT_SCENARIO.portfolio.assets);
      setLastRealImportAt(null);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Carteira</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="pf-capital" className="text-xs">Capital (R$)</Label>
          <Input
            id="pf-capital"
            type="number"
            step="1000"
            {...register("portfolio.capital", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pf-monthly" className="text-xs">Aporte mensal (R$)</Label>
          <Input
            id="pf-monthly"
            type="number"
            step="100"
            {...register("portfolio.monthlyContribution", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="pf-indexed" className="text-xs cursor-pointer">Aporte indexado ao IPCA</Label>
        <Controller
          control={control}
          name="portfolio.contributionInflationIndexed"
          render={({ field }) => (
            <Switch id="pf-indexed" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-2 mt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-2">Alocação por classe</p>
          <div className="flex items-center gap-2">
            <span
              data-testid="portfolio-sum-badge"
              className={
                "text-[10px] tabular px-1.5 py-0.5 rounded " +
                (sumOk
                  ? "text-brand-bright bg-brand-bright/10"
                  : "text-accent-coral bg-accent-coral/10")
              }
            >
              Σ {formatPercent(sum, 1)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviewImport}
              disabled={!canImport}
              className="h-6 px-2 text-[11px]"
            >
              <Download className="w-3 h-3 mr-1" />
              Usar carteira real
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={fields.length >= MAX_PORTFOLIO_ASSETS}
              className="h-6 px-2 text-[11px]"
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-6 px-2 text-[11px]"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {preview && (
          <div className="bg-bg-3 border border-line rounded-card p-3 space-y-2">
            <p className="text-[12px] text-ink">
              <span className="font-semibold">{formatRs(preview.totalBRL)}</span>{" "}
              em {preview.portfolio.assets.length} classes
              ({preview.positionsCount} posições RV, {preview.rfCount} RF)
            </p>
            {preview.skipped.length > 0 && (
              <p className="text-[11px] text-accent-amber">
                Ignorados (valor zero): {preview.skipped.join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-6 px-2 text-[11px]" onClick={handleConfirmImport}>
                Substituir cenário
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setPreview(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {lastRealImportAt && (
          <p className="text-[10px] text-ink-4">
            Importado da carteira real em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            }).format(new Date(lastRealImportAt))}
          </p>
        )}

        <div className="space-y-1">
          {fields.map((field, idx) => {
            const a = assets[idx];
            return (
              <div
                key={field.id}
                data-testid="asset-row"
                className="grid grid-cols-[12px_1fr_56px_56px_auto] gap-2 items-center text-xs py-1"
              >
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: assignColor(idx) }}
                />
                <span className="text-ink truncate">{a?.name ?? ""}</span>
                <span className="text-right tabular text-ink-2">{formatPercent(a?.weight ?? 0, 1)}</span>
                <span className="text-right tabular text-ink-3">{formatPercent(a?.expectedYield ?? 0, 1)}</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${a?.name ?? ""}`}
                    onClick={() => handleEdit(idx)}
                    className="p-1 text-ink-3 hover:text-ink"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${a?.name ?? ""}`}
                    onClick={() => handleRowDelete(idx, a?.name ?? "")}
                    className="p-1 text-ink-3 hover:text-accent-coral"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {portfolioError && (
          <p className="text-[11px] text-accent-coral pt-1">{portfolioError}</p>
        )}
        <p className="text-[10px] text-ink-4">colunas: cor · nome · peso · yield esperado</p>
      </div>

      <PortfolioAssetDialog
        open={dialog.open}
        mode={dialog.open ? dialog.mode : "add"}
        initial={dialog.open && dialog.mode === "edit" ? assets[dialog.index] : undefined}
        onClose={() => setDialog({ open: false })}
        onSubmit={handleSubmit}
        onDelete={dialog.open && dialog.mode === "edit" ? handleDeleteFromDialog : undefined}
      />
    </div>
  );
}
