"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { useAssetsStore } from "@/lib/ativos-store";
import { useMacro } from "@/lib/api";
import {
  proventosKpis,
  proventosMonthly,
  proventosByTicker,
} from "@/lib/proventos-derive";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { ASSET_CLASS_META } from "@/lib/ativos-schema";
import { formatRs2, formatPercent } from "@/lib/format";

function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function formatMonthShort(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${labels[Number(m) - 1]}/${y.slice(2)}`;
}

export function ProventosPageContent() {
  const positions = useAssetsStore((s) => s.positions);
  const paid = useAssetsStore((s) => s.proventsPaid);
  const scheduled = useAssetsStore((s) => s.scheduledEvents);
  const macro = useMacro();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  const kpis = useMemo(() => {
    if (!hydrated || !macro.data) return null;
    return proventosKpis(paid, scheduled, positions, macro.data);
  }, [hydrated, paid, scheduled, positions, macro.data]);

  const monthly = useMemo(() => {
    if (!hydrated) return [];
    return proventosMonthly(paid, scheduled, 24, 3);
  }, [hydrated, paid, scheduled]);

  const byTicker = useMemo(() => {
    if (!hydrated || !macro.data) return [];
    return proventosByTicker(paid, scheduled, positions, macro.data);
  }, [hydrated, paid, scheduled, positions, macro.data]);

  if (!hydrated || macro.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
      </div>
    );
  }
  if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;

  if (paid.length === 0 && scheduled.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Coins className="w-10 h-10 text-ink-3 mx-auto mb-3" />
          <p className="text-sm text-ink">Sem proventos registrados ainda.</p>
          <p className="text-xs text-ink-3 mt-1 max-w-md mx-auto">
            Importe na página <strong>/ativos</strong>: <em>Movimentação</em> para histórico recebido (Rendimento, Dividendo, JCP) e <em>Eventos</em> para próximos pagamentos agendados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Recebido nos últimos 12m"
          value={formatRs2(kpis?.paid12m ?? 0)}
          sub={paid.length > 0 ? `${paid.length} pagamentos` : "Sem histórico"}
          icon={Coins}
          feature
          valueColor="green"
        />
        <KpiCard
          label="Agendado (futuro)"
          value={formatRs2(kpis?.scheduledNext ?? 0)}
          sub={scheduled.length > 0 ? `${scheduled.length} pagamentos` : "Sem agenda"}
          icon={Calendar}
        />
        <KpiCard
          label="DY realizado 12m"
          value={formatPercent(kpis?.dyRealized ?? 0, 2)}
          sub={`Esperado: ${formatPercent(kpis?.dyExpectedBlended ?? 0, 2)}`}
          icon={TrendingUp}
          valueColor={
            kpis && kpis.dyExpectedBlended > 0 && kpis.dyRealized < kpis.dyExpectedBlended * 0.8
              ? "red"
              : "default"
          }
        />
        <KpiCard
          label="Próximo pagamento"
          value={kpis?.nextPayment ? formatRs2(kpis.nextPayment.netValue) : "—"}
          sub={
            kpis?.nextPayment
              ? `${kpis.nextPayment.ticker} · ${formatBrDate(kpis.nextPayment.date)}`
              : "Sem agendados"
          }
          icon={Calendar}
        />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-[13.5px] font-semibold text-ink">Proventos por mês</h3>
          <p className="text-[11.5px] text-ink-3 mt-1">
            Últimos 24 meses (histórico) + próximos 3 meses (agendados em barra clara).
          </p>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={monthly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-[13.5px] font-semibold text-ink">Por ativo</h3>
          <p className="text-[11.5px] text-ink-3 mt-1">
            DY realizado nos últimos 12m vs DY esperado da posição. Tickers fora da carteira atual ainda aparecem se receberam ou têm pagamento agendado.
          </p>
        </CardHeader>
        <CardContent>
          {byTicker.length === 0 ? (
            <p className="text-[12px] text-ink-3 py-8 text-center">Sem proventos por ativo no período.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="text-ink-3 border-b border-line-soft">
                    <th className="text-left font-normal py-2 pr-2">Ticker</th>
                    <th className="text-left font-normal py-2 px-2">Classe</th>
                    <th className="text-right font-normal py-2 px-2">Recebido 12m</th>
                    <th className="text-right font-normal py-2 px-2">Agendado</th>
                    <th className="text-right font-normal py-2 px-2">DY realizado</th>
                    <th className="text-right font-normal py-2 pl-2">DY esperado</th>
                  </tr>
                </thead>
                <tbody>
                  {byTicker.map((r) => {
                    const classLabel = r.assetClass === "UNKNOWN" ? "—" : ASSET_CLASS_META[r.assetClass].label;
                    const gap =
                      r.dyRealized !== null && r.dyExpected !== null
                        ? r.dyRealized - r.dyExpected
                        : null;
                    const dyClass = gap === null ? "text-ink-2" : gap >= 0 ? "text-brand-bright" : "text-accent-coral";
                    return (
                      <tr key={r.ticker} className="border-b border-line-soft last:border-b-0">
                        <td className="py-2 pr-2 text-ink font-semibold tabular">{r.ticker}</td>
                        <td className="py-2 px-2 text-ink-2">{classLabel}</td>
                        <td className="text-right py-2 px-2 tabular text-ink">{r.paid12m > 0 ? formatRs2(r.paid12m) : "—"}</td>
                        <td className="text-right py-2 px-2 tabular text-ink-2">{r.scheduled > 0 ? formatRs2(r.scheduled) : "—"}</td>
                        <td className={`text-right py-2 px-2 tabular ${dyClass}`}>
                          {r.dyRealized !== null ? formatPercent(r.dyRealized, 2) : "—"}
                        </td>
                        <td className="text-right py-2 pl-2 tabular text-ink-3">
                          {r.dyExpected !== null ? formatPercent(r.dyExpected, 2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {paid.length === 0 && scheduled.length > 0 && (
        <Card>
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-ink-3 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-ink-2">
              Você tem proventos agendados, mas nenhum histórico importado. Importe o relatório
              <strong> Movimentação</strong> (Extratos → Movimentação) na página /ativos para popular
              o histórico de Rendimento, Dividendo e JCP recebidos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const COLOR_BRAND = "#2af0c4";
const COLOR_INK3 = "#7d9591";
const COLOR_LINE_SOFT = "#1f2c2a";

function MonthlyChart({ data }: { data: { month: string; paid: number; scheduled: number }[] }) {
  if (data.length === 0) return <p className="text-[12px] text-ink-3 py-8 text-center">Sem dados.</p>;

  const W = 800;
  const H = 220;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 30;

  const maxVal = Math.max(...data.map((d) => Math.max(d.paid, d.scheduled)), 1);
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const barW = innerW / data.length;

  const yScale = (v: number) => PAD_TOP + innerH - (v / maxVal) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="min-w-[640px]">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={yScale(v)} y2={yScale(v)} stroke={COLOR_LINE_SOFT} strokeWidth="0.5" />
            <text x={PAD_LEFT - 4} y={yScale(v) + 3} textAnchor="end" fill={COLOR_INK3} fontSize="9">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = PAD_LEFT + i * barW + barW * 0.15;
          const w = barW * 0.7;
          const isPaid = d.paid > 0;
          const v = isPaid ? d.paid : d.scheduled;
          if (v <= 0) return null;
          const y = yScale(v);
          const h = PAD_TOP + innerH - y;
          return (
            <rect
              key={d.month}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={COLOR_BRAND}
              opacity={isPaid ? 0.85 : 0.35}
              rx={1.5}
            >
              <title>{`${formatMonthShort(d.month)} · ${formatRs2(v)}${isPaid ? "" : " (agendado)"}`}</title>
            </rect>
          );
        })}

        {data.map((d, i) => {
          if (i % 3 !== 0 && i !== data.length - 1) return null;
          const x = PAD_LEFT + i * barW + barW / 2;
          return (
            <text key={`x-${d.month}`} x={x} y={H - 10} textAnchor="middle" fill={COLOR_INK3} fontSize="9">
              {formatMonthShort(d.month)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
