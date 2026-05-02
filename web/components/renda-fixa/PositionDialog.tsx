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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FixedIncomePosition } from "@/lib/fi-schema";

const formSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, "obrigatório"),
    initialAmount: z.number().positive(),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    indexer: z.enum(["prefixado", "cdi", "selic", "ipca"]),
    rate: z.number(),
    maturityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    isTaxExempt: z.boolean(),
  })
  .refine((p) => !p.maturityDate || p.maturityDate > p.purchaseDate, {
    message: "vencimento deve ser posterior à data de aporte",
    path: ["maturityDate"],
  });

type FormValues = z.infer<typeof formSchema>;

const RATE_HINTS = {
  prefixado: "ex: 12 = 12% a.a.",
  cdi: "ex: 95 = 95% do CDI",
  selic: "ex: 0.1 = Selic + 0,1%",
  ipca: "ex: 6 = IPCA + 6%",
};

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial?: FixedIncomePosition;
  onClose: () => void;
  onSubmit: (p: Omit<FixedIncomePosition, "color">) => void;
  onDelete?: (id: string) => void;
};

export function PositionDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initial?.id ?? crypto.randomUUID(),
      name: initial?.name ?? "",
      initialAmount: initial?.initialAmount ?? 0,
      purchaseDate: initial?.purchaseDate ?? today,
      indexer: initial?.indexer ?? "cdi",
      rate: initial?.rate ?? 1.0,
      maturityDate: initial?.maturityDate ?? null,
      isTaxExempt: initial?.isTaxExempt ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: initial?.id ?? crypto.randomUUID(),
        name: initial?.name ?? "",
        initialAmount: initial?.initialAmount ?? 0,
        purchaseDate: initial?.purchaseDate ?? today,
        indexer: initial?.indexer ?? "cdi",
        rate: initial?.rate ?? 1.0,
        maturityDate: initial?.maturityDate ?? null,
        isTaxExempt: initial?.isTaxExempt ?? false,
      });
    }
  }, [open, initial, today, form]);

  const indexer = form.watch("indexer");

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Adicionar posição" : "Editar posição"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="fi-name">Nome</Label>
            <Input id="fi-name" {...form.register("name")} placeholder="LCI Banco X 2027" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fi-indexer">Indexador</Label>
              <Select
                value={form.watch("indexer")}
                onValueChange={(v) => form.setValue("indexer", v as FormValues["indexer"])}
              >
                <SelectTrigger id="fi-indexer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefixado">Prefixado</SelectItem>
                  <SelectItem value="cdi">% do CDI</SelectItem>
                  <SelectItem value="selic">Selic +</SelectItem>
                  <SelectItem value="ipca">IPCA +</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fi-rate">Taxa</Label>
              <Input
                id="fi-rate"
                type="number"
                step="0.01"
                {...form.register("rate", { valueAsNumber: true })}
              />
              <p className="text-[10px] text-ink-4">{RATE_HINTS[indexer]}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fi-amount">Aporte (R$)</Label>
            <Input
              id="fi-amount"
              type="number"
              step="100"
              {...form.register("initialAmount", { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fi-purchase">Data de compra</Label>
              <Input id="fi-purchase" type="date" {...form.register("purchaseDate")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fi-maturity">Vencimento (opcional)</Label>
              <Input
                id="fi-maturity"
                type="date"
                {...form.register("maturityDate", {
                  setValueAs: (v) => (v === "" || v == null ? null : v),
                })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="fi-exempt" className="cursor-pointer">Isento de IR (LCI/LCA/etc)</Label>
            <Switch
              id="fi-exempt"
              checked={form.watch("isTaxExempt")}
              onCheckedChange={(v) => form.setValue("isTaxExempt", v)}
            />
          </div>

          <DialogFooter className="flex justify-between items-center pt-4 border-t border-line-soft">
            {mode === "edit" && onDelete && initial ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (confirm("Excluir esta posição?")) {
                    onDelete(initial.id);
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
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
