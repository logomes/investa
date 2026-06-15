"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMacro } from "@/lib/api";
import { useScenarioStore } from "@/lib/store";
import { equivalentCdbRate } from "@/lib/tax-compare";
import { formatPercent } from "@/lib/format";

function defaultLciRate(scenario: ReturnType<typeof useScenarioStore.getState>["scenario"]): number {
  const isento = scenario.portfolio.assets.find((a) => a.taxProfile === "isento");
  return isento?.expectedYield ?? 0.09;
}

export function LciCdbCard() {
  const scenario = useScenarioStore((s) => s.scenario);
  const macro = useMacro();

  // Stored as decimal (0.09); edited as percent (9,00) like other rate inputs.
  const [lciPct, setLciPct] = useState(() => defaultLciRate(scenario) * 100);

  const lciRate = (Number.isFinite(lciPct) ? lciPct : 0) / 100;
  const equivalent = equivalentCdbRate(lciRate, scenario.horizon);
  const cdi = macro.data?.cdi;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">LCI isenta vs CDB tributado</h3>
      </CardHeader>
      <CardContent>
        <p className="text-[12px] text-ink-3">
          Uma LCI isenta de IR equivale a um CDB com taxa bruta maior, já que o CDB paga
          IR regressivo no resgate. Veja o CDB equivalente no seu horizonte de {scenario.horizon}{" "}
          {scenario.horizon === 1 ? "ano" : "anos"}.
        </p>

        <div className="mt-4 space-y-1">
          <Label htmlFor="lci-rate">Taxa da LCI (a.a.)</Label>
          <Input
            id="lci-rate"
            type="number"
            step="0.1"
            value={Number.isNaN(lciPct) ? "" : lciPct}
            onChange={(e) => setLciPct(e.target.valueAsNumber)}
          />
        </div>

        <dl className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <dt className="text-[12px] text-ink-3">CDB equivalente (a.a.)</dt>
            <dd className="text-[13.5px] font-semibold text-ink tabular">
              {formatPercent(equivalent, 2)}
            </dd>
          </div>
          {cdi != null && (
            <div className="flex items-baseline justify-between">
              <dt className="text-[12px] text-ink-3">Equivalente como % do CDI</dt>
              <dd className="text-[13.5px] font-semibold text-ink tabular">
                {formatPercent(equivalent / cdi, 1)}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
