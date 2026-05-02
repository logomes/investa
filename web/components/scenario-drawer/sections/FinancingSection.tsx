"use client";

import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DEFAULT_FINANCING } from "@/lib/defaults";

const NUMBER_INPUTS: Array<{
  name: "termYears" | "annualRate" | "entryPct" | "monthlyInsuranceRate";
  label: string;
  step: string;
  hint?: string;
}> = [
  { name: "termYears",            label: "Prazo (anos)",              step: "1" },
  { name: "annualRate",           label: "Taxa anual",                step: "0.005", hint: "0,115 = 11,5%" },
  { name: "entryPct",             label: "Entrada",                   step: "0.05",  hint: "0,20 = 20%" },
  { name: "monthlyInsuranceRate", label: "Seguro mensal sobre saldo", step: "0.0001", hint: "0,0005 = 0,05%/mês" },
];

export function FinancingSection() {
  const { register, watch, setValue } = useFormContext<ScenarioFormValues>();
  const financing = watch("realEstate.financing");
  const enabled = financing !== null;

  const onToggle = (v: boolean) => {
    setValue("realEstate.financing", v ? DEFAULT_FINANCING : null, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">
          Financiamento
        </h3>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Financiar imóvel" />
      </div>

      {enabled && (
        <div className="grid grid-cols-2 gap-3">
          {NUMBER_INPUTS.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={`fin-${f.name}`} className="text-xs">{f.label}</Label>
              <Input
                id={`fin-${f.name}`}
                type="number"
                step={f.step}
                {...register(`realEstate.financing.${f.name}`, { valueAsNumber: true })}
              />
              {f.hint && <p className="text-[10px] text-ink-4">{f.hint}</p>}
            </div>
          ))}
          <div className="space-y-1 col-span-2">
            <Label htmlFor="fin-system" className="text-xs">Sistema</Label>
            <Select
              value={watch("realEstate.financing.system") ?? "SAC"}
              onValueChange={(v) => setValue("realEstate.financing.system", v as "SAC" | "Price", { shouldDirty: true })}
            >
              <SelectTrigger id="fin-system">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAC">SAC (parcelas decrescentes)</SelectItem>
                <SelectItem value="Price">Price (parcelas constantes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
