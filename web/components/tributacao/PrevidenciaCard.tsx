"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScenarioStore } from "@/lib/store";
import { comparePrevidencia } from "@/lib/previdencia";
import { formatRs } from "@/lib/format";

// pt-BR defaults: renda 120k, aporte 14,4k (= 12% da renda, dedução cheia),
// alíquota marginal 27,5% (faixa mais alta — onde o PGBL costuma compensar).
const DEFAULT_RENDA = 120000;
const DEFAULT_APORTE = 14400;
const DEFAULT_ALIQUOTA = 0.275;

const ALIQUOTAS: { value: number; label: string }[] = [
  { value: 0.075, label: "7,5%" },
  { value: 0.15, label: "15%" },
  { value: 0.225, label: "22,5%" },
  { value: 0.275, label: "27,5%" },
];

export function PrevidenciaCard() {
  const scenario = useScenarioStore((s) => s.scenario);

  const [renda, setRenda] = useState(DEFAULT_RENDA);
  const [aporte, setAporte] = useState(DEFAULT_APORTE);
  const [aliquota, setAliquota] = useState(DEFAULT_ALIQUOTA);
  // Taxa de retorno guardada como decimal; editada como percent (× 100).
  const [retornoPct, setRetornoPct] = useState(() => scenario.benchmark.annualRate * 100);

  const taxaRetorno = (Number.isFinite(retornoPct) ? retornoPct : 0) / 100;

  const result = comparePrevidencia({
    rendaTributavelAnual: Number.isFinite(renda) ? renda : 0,
    aporteAnual: Number.isFinite(aporte) ? aporte : 0,
    aliquotaMarginal: aliquota,
    taxaRetorno,
    horizonYears: scenario.horizon,
  });

  const pgblWins = result.diff > 0;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13.5px] font-semibold text-ink">PGBL vs VGBL</h3>
      </CardHeader>
      <CardContent>
        <p className="text-[12px] text-ink-3">
          O PGBL deduz o aporte (até 12% da renda) na declaração completa, mas tributa o
          montante total no resgate; o VGBL não deduz e tributa só o ganho. Compare o líquido
          final no seu horizonte de {scenario.horizon}{" "}
          {scenario.horizon === 1 ? "ano" : "anos"} (regressiva por tranche).
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="prev-renda">Renda tributável anual (R$)</Label>
            <Input
              id="prev-renda"
              type="number"
              step="1000"
              value={Number.isNaN(renda) ? "" : renda}
              onChange={(e) => setRenda(e.target.valueAsNumber)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="prev-aporte">Aporte anual (R$)</Label>
            <Input
              id="prev-aporte"
              type="number"
              step="600"
              value={Number.isNaN(aporte) ? "" : aporte}
              onChange={(e) => setAporte(e.target.valueAsNumber)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="prev-aliquota">Alíquota marginal</Label>
            <select
              id="prev-aliquota"
              value={aliquota}
              onChange={(e) => setAliquota(Number(e.target.value))}
              className="w-full bg-bg-2 border border-line rounded-md px-2 py-1.5 text-xs text-ink"
            >
              {ALIQUOTAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="prev-retorno">Taxa de retorno (a.a.)</Label>
            <Input
              id="prev-retorno"
              type="number"
              step="0.1"
              value={Number.isNaN(retornoPct) ? "" : retornoPct}
              onChange={(e) => setRetornoPct(e.target.valueAsNumber)}
            />
          </div>
        </div>

        <dl className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <dt className="text-[12px] text-ink-3">Líquido PGBL</dt>
            <dd className="text-[13.5px] font-semibold text-ink tabular">
              {formatRs(result.netPgbl)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[12px] text-ink-3">Líquido VGBL</dt>
            <dd className="text-[13.5px] font-semibold text-ink tabular">
              {formatRs(result.netVgbl)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-[12px] text-ink-3">Diferença (PGBL − VGBL)</dt>
            <dd className="text-[13.5px] font-semibold text-ink tabular">
              {formatRs(result.diff)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[12px] text-ink-3">
          {pgblWins
            ? `PGBL compensa com declaração completa e prazo ≥ ${scenario.horizon}a`
            : "VGBL tende a compensar (declaração simplificada / alíquota baixa / prazo curto)"}
        </p>
      </CardContent>
    </Card>
  );
}
