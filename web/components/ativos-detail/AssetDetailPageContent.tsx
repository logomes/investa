"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Coins, Wallet } from "lucide-react";
import { useAssetsStore } from "@/lib/ativos-store";
import { useMacro } from "@/lib/api";
import { assetDetail } from "@/lib/asset-detail-derive";
import { ASSET_CLASS_META, FII_SUBTYPE_LABEL } from "@/lib/ativos-schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { ErrorCard } from "@/components/error/ErrorCard";
import { formatRs2, formatPercent } from "@/lib/format";
import { relativeTime } from "@/lib/relative-time";

function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

type Props = { ticker: string };

export function AssetDetailPageContent({ ticker }: Props) {
  const positions = useAssetsStore((s) => s.positions);
  const trades = useAssetsStore((s) => s.trades);
  const proventsPaid = useAssetsStore((s) => s.proventsPaid);
  const scheduled = useAssetsStore((s) => s.scheduledEvents);
  const macro = useMacro();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  const detail = useMemo(() => {
    if (!hydrated || !macro.data) return null;
    return assetDetail(ticker, positions, trades, proventsPaid, scheduled, macro.data);
  }, [hydrated, macro.data, ticker, positions, trades, proventsPaid, scheduled]);

  if (!hydrated || macro.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
      </div>
    );
  }
  if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;
  if (!detail) return null;

  const { position } = detail;
  const meta = position ? ASSET_CLASS_META[position.assetClass] : null;
  const tickerUpper = ticker.toUpperCase();
  const hasData = position || detail.trades.length > 0 || detail.paid.length > 0 || detail.scheduled.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <Link href="/ativos" className="inline-flex items-center gap-2 text-[12px] text-ink-3 hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Ativos
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-ink">Nenhum dado encontrado para <strong>{tickerUpper}</strong>.</p>
            <p className="text-xs text-ink-3 mt-1">
              Verifique se o ticker foi importado em /ativos (Posição / Movimentação / Negociação / Eventos da B3).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/ativos" className="inline-flex items-center gap-2 text-[12px] text-ink-3 hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Ativos
        </Link>
        {position?.asOf && (
          <p className="text-[11.5px] text-ink-3">
            Cotação · {relativeTime(position.asOf)}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {meta && (
              <span
                aria-hidden
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: meta.color }}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold text-ink leading-tight">{tickerUpper}</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">
                {meta ? meta.label : "—"}
                {position?.fiiSubtype && (
                  <span> · {FII_SUBTYPE_LABEL[position.fiiSubtype]}</span>
                )}
                {position && <span> · {position.currency}</span>}
                {position && <span> · {position.quantity} cotas</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Posição atual"
          value={position ? formatRs2(detail.marketValueBRL) : "—"}
          sub={position && position.currentPrice ? `${formatRs2(position.currentPrice)} / cota` : "Sem cotação"}
          icon={Wallet}
          feature
        />
        <KpiCard
          label="Ganho não-realizado"
          value={detail.unrealized ? formatRs2(detail.unrealized.gainBRL) : "—"}
          sub={detail.unrealized ? formatPercent(detail.unrealized.gainPct, 2) : "—"}
          icon={TrendingUp}
          valueColor={detail.unrealized ? (detail.unrealized.gainBRL >= 0 ? "green" : "red") : "default"}
        />
        <KpiCard
          label="Proventos 12m"
          value={formatRs2(detail.paid12m)}
          sub={`Acumulado: ${formatRs2(detail.paidAllTime)}`}
          icon={Coins}
          valueColor={detail.paid12m > 0 ? "green" : "default"}
        />
        <KpiCard
          label="DY realizado 12m"
          value={detail.dyRealized12m !== null ? formatPercent(detail.dyRealized12m, 2) : "—"}
          sub={detail.dyExpected !== null ? `Esperado: ${formatPercent(detail.dyExpected, 2)}` : "—"}
          icon={TrendingUp}
        />
      </div>

      {(detail.totalInvested > 0 || detail.totalWithdrawn > 0) && (
        <Card>
          <CardHeader>
            <h3 className="text-[13.5px] font-semibold text-ink">ROI consolidado</h3>
            <p className="text-[11.5px] text-ink-3 mt-1">
              Soma das compras menos vendas (custo líquido) vs valor atual + proventos recebidos.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
              <div>
                <p className="text-ink-3">Total comprado</p>
                <p className="text-ink tabular font-semibold">{formatRs2(detail.totalInvested)}</p>
              </div>
              <div>
                <p className="text-ink-3">Total vendido</p>
                <p className="text-ink tabular font-semibold">{formatRs2(detail.totalWithdrawn)}</p>
              </div>
              <div>
                <p className="text-ink-3">Retorno total</p>
                <p className={`tabular font-semibold ${detail.totalReturn >= 0 ? "text-brand-bright" : "text-accent-coral"}`}>
                  {detail.totalReturn >= 0 ? "+" : ""}{formatRs2(detail.totalReturn)}
                </p>
              </div>
              <div>
                <p className="text-ink-3">ROI total</p>
                <p className={`tabular font-semibold ${detail.roiTotal !== null && detail.roiTotal >= 0 ? "text-brand-bright" : "text-accent-coral"}`}>
                  {detail.roiTotal !== null ? formatPercent(detail.roiTotal, 2) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {detail.trades.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-[13.5px] font-semibold text-ink">Histórico de trades</h3>
            <p className="text-[11.5px] text-ink-3 mt-1">
              {detail.trades.length} negociações importadas da B3.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="text-ink-3 border-b border-line-soft">
                    <th className="text-left font-normal py-2 pr-2">Data</th>
                    <th className="text-left font-normal py-2 px-2">Operação</th>
                    <th className="text-right font-normal py-2 px-2">Qty</th>
                    <th className="text-right font-normal py-2 px-2">Preço</th>
                    <th className="text-right font-normal py-2 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.trades.slice().reverse().map((t, i) => (
                    <tr key={`${t.date}-${i}`} className="border-b border-line-soft last:border-b-0">
                      <td className="py-2 pr-2 text-ink tabular">{formatBrDate(t.date)}</td>
                      <td className={`py-2 px-2 font-semibold ${t.side === "buy" ? "text-brand-bright" : "text-accent-coral"}`}>
                        {t.side === "buy" ? "Compra" : "Venda"}
                      </td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{t.quantity}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs2(t.price)}</td>
                      <td className="text-right py-2 pl-2 tabular text-ink">{formatRs2(t.quantity * t.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(detail.paid.length > 0 || detail.scheduled.length > 0) && (
        <Card>
          <CardHeader>
            <h3 className="text-[13.5px] font-semibold text-ink">Proventos</h3>
            <p className="text-[11.5px] text-ink-3 mt-1">
              {detail.paid.length} pagamentos já recebidos · {detail.scheduled.length} agendados (total agendado {formatRs2(detail.scheduledTotal)}).
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="text-ink-3 border-b border-line-soft">
                    <th className="text-left font-normal py-2 pr-2">Data</th>
                    <th className="text-left font-normal py-2 px-2">Status</th>
                    <th className="text-left font-normal py-2 px-2">Tipo</th>
                    <th className="text-right font-normal py-2 pl-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.scheduled.map((e) => (
                    <tr key={`s-${e.paymentDate}-${e.type}`} className="border-b border-line-soft">
                      <td className="py-2 pr-2 text-ink tabular">{formatBrDate(e.paymentDate)}</td>
                      <td className="py-2 px-2 text-ink-3">Agendado</td>
                      <td className="py-2 px-2 text-ink-2">{e.type}</td>
                      <td className="text-right py-2 pl-2 tabular text-ink">{formatRs2(e.netValue)}</td>
                    </tr>
                  ))}
                  {detail.paid.slice().reverse().map((p, i) => (
                    <tr key={`p-${p.paidDate}-${i}`} className="border-b border-line-soft last:border-b-0">
                      <td className="py-2 pr-2 text-ink tabular">{formatBrDate(p.paidDate)}</td>
                      <td className="py-2 px-2 text-brand-bright">Recebido</td>
                      <td className="py-2 px-2 text-ink-2">{p.type}</td>
                      <td className="text-right py-2 pl-2 tabular text-ink">{formatRs2(p.netValue)}</td>
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
