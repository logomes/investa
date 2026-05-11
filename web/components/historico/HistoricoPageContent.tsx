"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, History, TrendingUp, Trash2 } from "lucide-react";
import { useAssetsStore } from "@/lib/ativos-store";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { usePatrimonySnapshotStore } from "@/lib/patrimony-snapshot-store";
import { computeSnapshot } from "@/lib/patrimony-snapshot";
import { useMacro } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { Button } from "@/components/ui/button";
import { formatRs, formatPercent } from "@/lib/format";

const COLOR_BRAND = "#2af0c4";
const COLOR_INK3 = "#7d9591";
const COLOR_LINE_SOFT = "#1f2c2a";

function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function HistoricoPageContent() {
  const positions = useAssetsStore((s) => s.positions);
  const fiPositions = useFixedIncomeStore((s) => s.positions);
  const snapshots = usePatrimonySnapshotStore((s) => s.snapshots);
  const addSnapshot = usePatrimonySnapshotStore((s) => s.addSnapshot);
  const removeSnapshot = usePatrimonySnapshotStore((s) => s.removeSnapshot);
  const macro = useMacro();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    useFixedIncomeStore.persist.rehydrate();
    usePatrimonySnapshotStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  const currentSnapshot = useMemo(() => {
    if (!hydrated || !macro.data) return null;
    return computeSnapshot(positions, fiPositions, macro.data);
  }, [hydrated, macro.data, positions, fiPositions]);

  const lastSaved = snapshots[snapshots.length - 1];
  const delta = useMemo(() => {
    if (!currentSnapshot || !lastSaved) return null;
    const abs = currentSnapshot.totalBRL - lastSaved.totalBRL;
    const pct = lastSaved.totalBRL > 0 ? abs / lastSaved.totalBRL : 0;
    return { abs, pct };
  }, [currentSnapshot, lastSaved]);

  if (!hydrated || macro.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
      </div>
    );
  }
  if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;

  const empty = positions.length === 0 && fiPositions.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="Patrimônio atual (M2M)"
          value={currentSnapshot ? formatRs(currentSnapshot.totalBRL) : "R$ 0"}
          sub={
            currentSnapshot
              ? `RV ${formatRs(currentSnapshot.rendaVariavel)} · RF ${formatRs(currentSnapshot.rendaFixa)}`
              : "—"
          }
          icon={TrendingUp}
          feature
        />
        <KpiCard
          label="vs último snapshot"
          value={delta ? `${delta.abs >= 0 ? "+" : ""}${formatRs(delta.abs)}` : "—"}
          sub={
            delta
              ? `${formatPercent(delta.pct, 2)} desde ${formatBrDate(lastSaved!.date)}`
              : "Capture o primeiro snapshot"
          }
          icon={TrendingUp}
          valueColor={delta ? (delta.abs >= 0 ? "green" : "red") : "default"}
        />
        <KpiCard
          label="Snapshots gravados"
          value={String(snapshots.length)}
          sub={
            snapshots.length === 0
              ? "Nenhum ainda"
              : `${formatBrDate(snapshots[0].date)} → ${formatBrDate(lastSaved!.date)}`
          }
          icon={History}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-[13.5px] font-semibold text-ink">Snapshot mensal de patrimônio</h3>
              <p className="text-[11.5px] text-ink-3 mt-1">
                Capture seu PL marcado a mercado (RV + RF) hoje. Repetir uma vez por mês cria o histórico real, base para gráfico de evolução e TWR futuro.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!currentSnapshot) return;
                addSnapshot(currentSnapshot);
              }}
              disabled={empty || !currentSnapshot}
            >
              <Camera className="w-3.5 h-3.5 mr-1.5" />
              Capturar agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {empty ? (
            <p className="text-[12px] text-ink-3 py-8 text-center">
              Importe ou cadastre posições em <strong>/ativos</strong> ou <strong>/renda-fixa</strong> antes de gerar snapshots.
            </p>
          ) : snapshots.length === 0 ? (
            <p className="text-[12px] text-ink-3 py-8 text-center">
              Nenhum snapshot ainda. Clique em <strong>Capturar agora</strong> para gravar o primeiro.
            </p>
          ) : (
            <EvolutionChart snapshots={snapshots} />
          )}
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-[13.5px] font-semibold text-ink">Histórico</h3>
            <p className="text-[11.5px] text-ink-3 mt-1">
              Snapshots ordenados do mais recente. Capturar duas vezes no mesmo dia sobrescreve.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full min-w-[640px] text-[12px]">
                <thead>
                  <tr className="text-ink-3 border-b border-line-soft">
                    <th className="text-left font-normal py-2 pr-2">Data</th>
                    <th className="text-right font-normal py-2 px-2">Total PL</th>
                    <th className="text-right font-normal py-2 px-2">Renda Variável</th>
                    <th className="text-right font-normal py-2 px-2">Renda Fixa</th>
                    <th className="text-right font-normal py-2 px-2">Posições</th>
                    <th className="text-right font-normal py-2 pl-2 w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice().reverse().map((s) => (
                    <tr key={s.date} className="border-b border-line-soft last:border-b-0">
                      <td className="py-2 pr-2 text-ink tabular">{formatBrDate(s.date)}</td>
                      <td className="text-right py-2 px-2 tabular text-ink font-semibold">{formatRs(s.totalBRL)}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs(s.rendaVariavel)}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs(s.rendaFixa)}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-3">{s.positionsCount} RV · {s.rfCount} RF</td>
                      <td className="text-right py-2 pl-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover snapshot de ${formatBrDate(s.date)}`}
                          onClick={() => {
                            if (confirm(`Remover snapshot de ${formatBrDate(s.date)}?`)) removeSnapshot(s.date);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EvolutionChart({ snapshots }: { snapshots: import("@/lib/patrimony-snapshot").PatrimonySnapshot[] }) {
  if (snapshots.length === 0) return null;

  const W = 800;
  const H = 240;
  const PAD_LEFT = 56;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 28;

  const minVal = Math.min(...snapshots.map((s) => s.totalBRL));
  const maxVal = Math.max(...snapshots.map((s) => s.totalBRL));
  const rangeRaw = maxVal - minVal;
  const yMin = rangeRaw > 0 ? minVal - rangeRaw * 0.1 : minVal * 0.9;
  const yMax = rangeRaw > 0 ? maxVal + rangeRaw * 0.1 : maxVal * 1.1;
  const yRange = yMax - yMin || 1;

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const xScale = (i: number) =>
    snapshots.length === 1
      ? PAD_LEFT + innerW / 2
      : PAD_LEFT + (i / (snapshots.length - 1)) * innerW;
  const yScale = (v: number) => PAD_TOP + innerH - ((v - yMin) / yRange) * innerH;

  const path = snapshots
    .map((s, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(s.totalBRL).toFixed(1)}`)
    .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * yRange);

  // Label every Nth point so the X axis doesn't overlap
  const labelEvery = Math.max(1, Math.ceil(snapshots.length / 8));

  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="min-w-[640px]">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={yScale(v)} y2={yScale(v)} stroke={COLOR_LINE_SOFT} strokeWidth="0.5" />
            <text x={PAD_LEFT - 6} y={yScale(v) + 3} textAnchor="end" fill={COLOR_INK3} fontSize="9">
              {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={path} fill="none" stroke={COLOR_BRAND} strokeWidth="2" />

        {snapshots.map((s, i) => (
          <circle key={s.date} cx={xScale(i)} cy={yScale(s.totalBRL)} r="3" fill={COLOR_BRAND}>
            <title>{`${formatBrDate(s.date)}: ${s.totalBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}</title>
          </circle>
        ))}

        {snapshots.map((s, i) => {
          if (i % labelEvery !== 0 && i !== snapshots.length - 1) return null;
          return (
            <text key={`x-${s.date}`} x={xScale(i)} y={H - 10} textAnchor="middle" fill={COLOR_INK3} fontSize="9">
              {formatBrDate(s.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
