"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PORTFOLIO_ASSET_TYPES,
  PORTFOLIO_TYPE_BY_ID,
  type PortfolioAssetTypeId,
} from "@/lib/portfolio-asset-types";
import type { PortfolioAssetInput } from "@/lib/api-types";

const formSchema = z.object({
  typeId: z.string(),
  name: z.string().min(1, "obrigatório"),
  weight: z.number().min(0, "0–100%").max(100, "0–100%"),
  expectedYield: z.number().min(-100, "-100–100%").max(100, "-100–100%"),
  capitalGain: z.number().min(-100, "-100–100%").max(100, "-100–100%"),
  taxRate: z.number().min(0, "0–100%").max(100, "0–100%"),
  volatility: z.number().min(0, "0–100%").max(100, "0–100%"),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial?: PortfolioAssetInput;
  onClose: () => void;
  onSubmit: (asset: PortfolioAssetInput) => void;
  onDelete?: () => void;
};

const DEFAULT_TYPE: PortfolioAssetTypeId = "FII_PAPEL";

function pctFromInitial(initial: PortfolioAssetInput | undefined, defaults: typeof PORTFOLIO_TYPE_BY_ID[PortfolioAssetTypeId]["defaults"]): FormValues {
  if (initial) {
    return {
      typeId: DEFAULT_TYPE,
      name: initial.name,
      weight: initial.weight * 100,
      expectedYield: initial.expectedYield * 100,
      capitalGain: initial.capitalGain * 100,
      taxRate: initial.taxRate * 100,
      volatility: initial.volatility * 100,
      note: initial.note,
    };
  }
  return {
    typeId: DEFAULT_TYPE,
    name: PORTFOLIO_TYPE_BY_ID[DEFAULT_TYPE].label,
    weight: 0,
    expectedYield: defaults.expectedYield * 100,
    capitalGain: defaults.capitalGain * 100,
    taxRate: defaults.taxRate * 100,
    volatility: defaults.volatility * 100,
    note: "",
  };
}

export function PortfolioAssetDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: pctFromInitial(initial, PORTFOLIO_TYPE_BY_ID[DEFAULT_TYPE].defaults),
  });

  useEffect(() => {
    if (open) {
      form.reset(pctFromInitial(initial, PORTFOLIO_TYPE_BY_ID[DEFAULT_TYPE].defaults));
    }
  }, [open, initial, form]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const typeId = e.target.value as PortfolioAssetTypeId;
    form.setValue("typeId", typeId);
    if (mode === "add") {
      const meta = PORTFOLIO_TYPE_BY_ID[typeId];
      form.setValue("name", meta.label);
      form.setValue("expectedYield", meta.defaults.expectedYield * 100);
      form.setValue("capitalGain", meta.defaults.capitalGain * 100);
      form.setValue("taxRate", meta.defaults.taxRate * 100);
      form.setValue("volatility", meta.defaults.volatility * 100);
    }
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit({
      name: data.name,
      weight: data.weight / 100,
      expectedYield: data.expectedYield / 100,
      capitalGain: data.capitalGain / 100,
      taxRate: data.taxRate / 100,
      volatility: data.volatility / 100,
      note: data.note,
    });
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Adicionar ativo" : "Editar ativo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="pa-type">Tipo</Label>
            <select
              id="pa-type"
              {...form.register("typeId")}
              onChange={handleTypeChange}
              className="w-full bg-bg-2 border border-line rounded-md px-2 py-1.5 text-xs text-ink"
            >
              {PORTFOLIO_ASSET_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pa-name">Nome</Label>
            <Input id="pa-name" {...form.register("name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pa-weight">Peso (%)</Label>
              <Input
                id="pa-weight"
                type="number"
                step="0.1"
                {...form.register("weight", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-yield">Yield esperado (%)</Label>
              <Input
                id="pa-yield"
                type="number"
                step="0.1"
                {...form.register("expectedYield", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pa-capgain">Ganho capital (%)</Label>
              <Input
                id="pa-capgain"
                type="number"
                step="0.1"
                {...form.register("capitalGain", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pa-tax">Imposto (%)</Label>
              <Input
                id="pa-tax"
                type="number"
                step="0.5"
                {...form.register("taxRate", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pa-vol">Volatilidade (%)</Label>
            <Input
              id="pa-vol"
              type="number"
              step="0.5"
              {...form.register("volatility", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pa-note">Nota</Label>
            <Input id="pa-note" {...form.register("note")} placeholder="opcional" />
          </div>

          <DialogFooter className="flex justify-between items-center pt-3 border-t border-line-soft">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (confirm("Excluir este ativo?")) {
                    onDelete();
                    onClose();
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
