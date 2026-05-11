"use client";

import Link from "next/link";
import { Info } from "lucide-react";

type Props = {
  trades: number;
  provents: number;
};

export function MissingPositionsBanner({ trades, provents }: Props) {
  // Shown when the user has historical data (trades/provents) but no live
  // positions — usually because they imported Movimentação but not Posição.
  if (trades === 0 && provents === 0) return null;

  const parts: string[] = [];
  if (trades > 0) parts.push(`${trades} trades`);
  if (provents > 0) parts.push(`${provents} proventos pagos`);

  return (
    <div className="bg-bg-2 border border-line rounded-card p-4 flex items-start gap-4">
      <div className="w-9 h-9 rounded-full bg-brand-bright/15 flex items-center justify-center flex-shrink-0">
        <Info className="w-5 h-5 text-brand-bright" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-tight">
          Histórico importado mas sem posições atuais
        </p>
        <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
          Você tem <strong>{parts.join(" + ")}</strong> no store, mas nenhuma posição.
          O DARF está em <Link href="/ir" className="text-brand-bright underline">/ir</Link> e os
          proventos em <Link href="/proventos" className="text-brand-bright underline">/proventos</Link>.
          Pra popular esta página, importe o XLSX <strong>Posição</strong> (B3 → Minha Carteira → Investimentos → Posição).
        </p>
      </div>
    </div>
  );
}
