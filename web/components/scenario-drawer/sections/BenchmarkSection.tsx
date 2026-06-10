"use client";

import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { useMacro } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { BenchmarkKind } from "@/lib/api-types";

const KIND_OPTIONS: Array<{ value: BenchmarkKind; label: string }> = [
  { value: "cdi", label: "CDI" },
  { value: "selic", label: "Selic" },
  { value: "ipca_plus", label: "IPCA + x%" },
];

export function BenchmarkSection() {
  const { register, setValue, watch } = useFormContext<ScenarioFormValues>();
  const macro = useMacro();
  const kind = watch("benchmark.kind");
  const ipcaSpread = watch("benchmark.ipcaSpread");

  // Rate prefill is interaction-driven (kind click / spread edit) — never on mount, so a manually saved rate always survives drawer reopen.
  const resolveRate = (nextKind: BenchmarkKind, spread: number): number | null => {
    if (!macro.data) return null;
    const base =
      nextKind === "cdi" ? macro.data.cdi :
      nextKind === "selic" ? macro.data.selic :
      macro.data.ipca + spread;
    return Number(base.toFixed(4));
  };

  const safeSpread = Number.isFinite(ipcaSpread) ? ipcaSpread : 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Benchmark</h3>
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de benchmark">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={kind === opt.value}
            onClick={() => {
              setValue("benchmark.kind", opt.value, { shouldDirty: true });
              const rate = resolveRate(opt.value, safeSpread);
              if (rate !== null) setValue("benchmark.annualRate", rate, { shouldDirty: true });
            }}
            className={`px-3 py-1.5 rounded-pill text-[12px] font-medium border transition-colors ${
              kind === opt.value
                ? "bg-brand-bright/15 border-brand-bright/50 text-ink"
                : "bg-bg-2 border-line text-ink-2 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kind === "ipca_plus" && (
          <div className="space-y-1">
            <Label htmlFor="bench-spread" className="text-xs">Spread sobre IPCA</Label>
            <Input
              id="bench-spread"
              type="number"
              step="0.005"
              {...register("benchmark.ipcaSpread", {
                valueAsNumber: true,
                onChange: (e) => {
                  const spread = Number(e.target.valueAsNumber);
                  const rate = resolveRate("ipca_plus", Number.isFinite(spread) ? spread : 0);
                  if (rate !== null) setValue("benchmark.annualRate", rate, { shouldDirty: true });
                },
              })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="bench-rate" className="text-xs">Taxa anual (nominal)</Label>
          <Input
            id="bench-rate"
            type="number"
            step="any"
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
