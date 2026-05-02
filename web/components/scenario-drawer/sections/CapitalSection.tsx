"use client";

import { Controller, useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function CapitalSection() {
  const { register, control, watch } = useFormContext<ScenarioFormValues>();
  const horizon = watch("horizon");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Capital & Horizonte</h3>

      <div className="space-y-1">
        <Label htmlFor="capital">Capital inicial (R$)</Label>
        <Input
          id="capital"
          type="number"
          step="1000"
          {...register("capital", { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="horizon">Horizonte</Label>
          <span className="text-xs text-ink-3 tabular">{horizon} {horizon === 1 ? "ano" : "anos"}</span>
        </div>
        <Controller
          control={control}
          name="horizon"
          render={({ field }) => (
            <Slider
              id="horizon"
              min={1}
              max={30}
              step={1}
              value={[field.value]}
              onValueChange={(v) => field.onChange(v[0])}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="reinvest" className="cursor-pointer">Reinvestir rendimentos</Label>
        <Controller
          control={control}
          name="reinvest"
          render={({ field }) => (
            <Switch id="reinvest" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </div>
  );
}
