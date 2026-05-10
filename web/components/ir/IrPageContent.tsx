"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, AlertCircle } from "lucide-react";
import { useAssetsStore } from "@/lib/ativos-store";
import { computeMonthlyDarf, tickerToClassMap, type TaxBucket, type MonthlyBucketSummary } from "@/lib/darf-calculator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi/KpiCard";
import { formatRs2, formatPercent } from "@/lib/format";

const BUCKET_LABEL: Record<TaxBucket, string> = {
  acoes_isenta: "Ações / ETF (BR)",
  acoes_tributada: "BDR / Stock US",
  fii: "FIIs",
};

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  return `${m}/${y}`;
}

function buildDarfStatusLabel(b: MonthlyBucketSummary): string {
  if (b.isExempt) return "Isento (vendas ≤ R$ 20k)";
  if (b.darfBRL > 0) return `DARF: ${formatRs2(b.darfBRL)} (${formatPercent(b.irRate, 0)})`;
  if (b.realizedGain < 0) return `Prejuízo: +${formatRs2(b.accumulatedLossOut - b.accumulatedLossIn)} acumulado`;
  return "Sem imposto (lucro compensado por prejuízo anterior)";
}

export function IrPageContent() {
  const positions = useAssetsStore((s) => s.positions);
  const trades = useAssetsStore((s) => s.trades);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  const darfs = useMemo(() => {
    if (!hydrated) return [];
    return computeMonthlyDarf(trades, tickerToClassMap(positions));
  }, [trades, positions, hydrated]);

  if (!hydrated) {
    return <Card><CardContent className="py-12 text-center text-ink-3">Carregando…</CardContent></Card>;
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm text-ink">Sem histórico de trades importado.</p>
            <p className="text-xs text-ink-3 mt-1">
              Importe o relatório <strong>Negociação</strong> (Extratos → Investidor B3) na página /ativos
              para gerar o cálculo de DARF mensal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // KPIs do mês corrente
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = darfs.find((d) => d.month === currentMonthKey);
  const lastMonth = darfs[darfs.length - 1];

  // Carry-forward final por bucket
  const finalCarry: Record<TaxBucket, number> = { acoes_isenta: 0, acoes_tributada: 0, fii: 0 };
  for (const d of darfs) {
    for (const b of d.buckets) {
      finalCarry[b.bucket] = b.accumulatedLossOut;
    }
  }
  const totalLossCarry = finalCarry.acoes_isenta + finalCarry.acoes_tributada + finalCarry.fii;

  const totalDarfPaid = darfs.reduce((s, d) => s + d.totalDarfBRL, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="DARF a pagar (mês corrente)"
          value={currentMonth ? formatRs2(currentMonth.totalDarfBRL) : "R$ 0,00"}
          sub={currentMonth ? `Vencimento: último dia útil de ${formatMonth(nextMonth(currentMonthKey))}` : "Sem trades este mês"}
          icon={FileText}
          feature
          valueColor={currentMonth && currentMonth.totalDarfBRL > 0 ? "red" : "default"}
        />
        <KpiCard
          label="Último mês com trades"
          value={lastMonth ? formatRs2(lastMonth.totalDarfBRL) : "—"}
          sub={lastMonth ? formatMonth(lastMonth.month) : "Sem dados"}
          icon={FileText}
        />
        <KpiCard
          label="Prejuízo acumulado total"
          value={formatRs2(totalLossCarry)}
          sub="Compensável em vendas futuras"
          icon={AlertCircle}
          valueColor={totalLossCarry > 0 ? "green" : "default"}
        />
        <KpiCard
          label="Total DARF já calculado"
          value={formatRs2(totalDarfPaid)}
          sub={`${darfs.length} meses computados`}
          icon={FileText}
        />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-[13.5px] font-semibold text-ink">DARF mensal por classe</h3>
          <p className="text-[11.5px] text-ink-3 mt-1">
            Walk dos seus trades importados. FIIs (20% IR, sem isenção) e Ações (15% IR, isentas se vendas ≤ R$ 20k) usam pools de prejuízo separados conforme regra fiscal.
          </p>
        </CardHeader>
        <CardContent>
          {darfs.length === 0 ? (
            <p className="text-[12px] text-ink-3 py-8 text-center">
              Trades importados não geraram vendas tributáveis ainda.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className="text-ink-3 border-b border-line-soft">
                  <th className="text-left font-normal py-2 pr-2">Mês</th>
                  <th className="text-left font-normal py-2 px-2">Classe</th>
                  <th className="text-right font-normal py-2 px-2">Vendas</th>
                  <th className="text-right font-normal py-2 px-2">Lucro/Prejuízo</th>
                  <th className="text-right font-normal py-2 px-2">Prejuízo prévio</th>
                  <th className="text-right font-normal py-2 px-2">Tributável</th>
                  <th className="text-right font-normal py-2 pl-2">DARF</th>
                </tr>
              </thead>
              <tbody>
                {darfs.flatMap((d) =>
                  d.buckets.map((b) => (
                    <tr key={`${d.month}-${b.bucket}`} className="border-b border-line-soft last:border-b-0">
                      <td className="py-2 pr-2 text-ink">{formatMonth(d.month)}</td>
                      <td className="py-2 px-2 text-ink-2">{BUCKET_LABEL[b.bucket]}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{formatRs2(b.salesBRL)}</td>
                      <td className={`text-right py-2 px-2 tabular ${b.realizedGain >= 0 ? "text-brand-bright" : "text-accent-coral"}`}>
                        {b.realizedGain >= 0 ? "+" : ""}{formatRs2(b.realizedGain)}
                      </td>
                      <td className="text-right py-2 px-2 tabular text-ink-3">{b.accumulatedLossIn > 0 ? `-${formatRs2(b.accumulatedLossIn)}` : "—"}</td>
                      <td className="text-right py-2 px-2 tabular text-ink-2">{b.taxableGain > 0 ? formatRs2(b.taxableGain) : "—"}</td>
                      <td className="text-right py-2 pl-2 tabular font-semibold text-ink">
                        <div className="leading-tight">
                          <div>{b.darfBRL > 0 ? formatRs2(b.darfBRL) : "—"}</div>
                          <div className="text-[10px] text-ink-3 font-normal">{buildDarfStatusLabel(b)}</div>
                        </div>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-[13.5px] font-semibold text-ink">Como pagar a DARF</h3>
        </CardHeader>
        <CardContent className="text-[12.5px] text-ink-2 space-y-2 leading-relaxed">
          <p>1. Acesse <a href="https://www.gov.br/receitafederal/pt-br" target="_blank" rel="noopener" className="text-brand-bright underline">gov.br/receitafederal</a> → Sicalc Web.</p>
          <p>2. Código da Receita: <strong className="text-ink">6015</strong> (renda variável swing/day trade).</p>
          <p>3. Período de apuração: o mês das vendas (ex: 02/2026 pra DARF que vencerá em 31/03/2026).</p>
          <p>4. Vencimento: <strong className="text-ink">último dia útil do mês seguinte</strong>. Atrasos: multa 0,33%/dia (max 20%) + Selic.</p>
          <p className="text-ink-3 text-[11.5px] mt-3 pt-3 border-t border-line-soft">
            ⚠ Esta calculadora cobre swing trade de Ações BR + ETF + BDR + FII. Day trade (15% / 20%), Stock US com câmbio por trade, e Tesouro Direto não estão na v1. Valide com seu contador antes de pagar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
