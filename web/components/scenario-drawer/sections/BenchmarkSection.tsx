"use client";

import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BenchmarkSection() {
  const { register } = useFormContext<ScenarioFormValues>();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Benchmark (Tesouro Selic)</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="bench-selic" className="text-xs">Selic anual</Label>
          <Input
            id="bench-selic"
            type="number"
            step="0.0025"
            {...register("benchmark.annualRate", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bench-tax" className="text-xs">IR sobre rendimentos</Label>
          <Input
            id="bench-tax"
            type="number"
            step="0.005"
            {...register("benchmark.taxRate", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );
}
