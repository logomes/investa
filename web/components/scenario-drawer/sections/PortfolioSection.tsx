"use client";

import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function PortfolioSection() {
  const { register, control } = useFormContext<ScenarioFormValues>();
  const { fields } = useFieldArray({ control, name: "portfolio.assets" });

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
        <p className="text-xs font-medium text-ink-2">Alocação por classe</p>
        {fields.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
            <Input
              type="text"
              {...register(`portfolio.assets.${idx}.name`)}
              className="text-xs"
            />
            <Input
              type="number"
              step="0.01"
              {...register(`portfolio.assets.${idx}.weight`, { valueAsNumber: true })}
              className="text-xs"
              aria-label={`peso ${idx}`}
            />
            <Input
              type="number"
              step="0.005"
              {...register(`portfolio.assets.${idx}.expectedYield`, { valueAsNumber: true })}
              className="text-xs"
              aria-label={`yield ${idx}`}
            />
          </div>
        ))}
        <p className="text-[10px] text-ink-4">colunas: nome · peso (0–1) · yield esperado (decimal)</p>
      </div>
    </div>
  );
}
