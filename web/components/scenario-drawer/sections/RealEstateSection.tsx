"use client";

import { useFormContext } from "react-hook-form";
import type { ScenarioFormValues } from "../schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const NUMBER_INPUTS: Array<{
  name: keyof ScenarioFormValues["realEstate"];
  label: string;
  step: string;
  hint?: string;
}> = [
  { name: "propertyValue", label: "Valor do imóvel (R$)", step: "1000" },
  { name: "monthlyRent", label: "Aluguel mensal (R$)", step: "100" },
  { name: "annualAppreciation", label: "Valorização anual", step: "0.005", hint: "0,05 = 5%" },
  { name: "iptuRate", label: "IPTU sobre valor", step: "0.001", hint: "0,01 = 1%" },
  { name: "vacancyMonthsPerYear", label: "Vacância (meses/ano)", step: "0.5" },
  { name: "managementFeePct", label: "Taxa de administração", step: "0.01", hint: "0,10 = 10%" },
  { name: "maintenanceAnnual", label: "Manutenção anual (R$)", step: "100" },
  { name: "insuranceAnnual", label: "Seguro anual (R$)", step: "100" },
  { name: "incomeTaxBracket", label: "IR (carnê-leão)", step: "0.005" },
  { name: "acquisitionCostPct", label: "Custo de aquisição", step: "0.005" },
  { name: "appreciationVolatility", label: "Volatilidade da valorização", step: "0.01" },
];

export function RealEstateSection() {
  const { register } = useFormContext<ScenarioFormValues>();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">Imóvel</h3>
      <div className="grid grid-cols-2 gap-3">
        {NUMBER_INPUTS.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label htmlFor={`re-${f.name}`} className="text-xs">{f.label}</Label>
            <Input
              id={`re-${f.name}`}
              type="number"
              step={f.step}
              {...register(`realEstate.${f.name}`, { valueAsNumber: true })}
            />
            {f.hint && <p className="text-[10px] text-ink-4">{f.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
