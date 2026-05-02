"use client";

import { Controller, useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export function MonteCarloSection() {
  const { register, control, watch } = useFormContext<ScenarioFormValues>();
  const n = watch("mc.nTrajectories");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Monte Carlo</h3>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Trajetórias</Label>
          <span className="text-xs text-ink-3 tabular">{n.toLocaleString("pt-BR")}</span>
        </div>
        <Controller
          control={control}
          name="mc.nTrajectories"
          render={({ field }) => (
            <Slider
              min={100}
              max={50_000}
              step={100}
              value={[field.value]}
              onValueChange={(v) => field.onChange(v[0])}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="mc-seed" className="text-xs">Seed (opcional)</Label>
          <Input
            id="mc-seed"
            type="number"
            {...register("mc.seed", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mc-target" className="text-xs">Meta (R$)</Label>
          <Input
            id="mc-target"
            type="number"
            step="10000"
            {...register("mc.targetPatrimony", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );
}
