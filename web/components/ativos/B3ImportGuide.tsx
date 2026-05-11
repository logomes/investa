"use client";

import { useState } from "react";
import { HelpCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ReportRow = {
  name: string;
  populates: string;
  path: string;
  frequency: string;
};

const REPORTS: ReportRow[] = [
  {
    name: "Posição",
    populates: "/ativos — posições atuais (qty, preço de fechamento, broker, classe)",
    path: "Minha Carteira → Investimentos → Posição → Download XLSX",
    frequency: "Mensal — sempre que quiser atualizar preços de fechamento",
  },
  {
    name: "Movimentação",
    populates:
      "/ir — trades (DARF mensal) · /proventos — Rendimento, Dividendo, JCP recebidos",
    path: "Extratos → Movimentação → Download XLSX (até 12 meses por export)",
    frequency: "Mensal — manter histórico de proventos e trades em dia",
  },
  {
    name: "Negociação",
    populates: "/ir — versão mais limpa do histórico de trades (sem ruído de eventos)",
    path: "Extratos → Negociação → Download XLSX",
    frequency: "Anual — snapshot completo do ano-calendário pra DARF",
  },
  {
    name: "Eventos",
    populates:
      "/proventos — pagamentos agendados futuros · /ativos — banner 'Renda agendada'",
    path: "Extratos → Eventos → Download XLSX",
    frequency: "Quinzenal — quando quiser checar próximos proventos",
  },
];

export function B3ImportGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Como exportar da B3?">
            <HelpCircle className="w-4 h-4" />
          </Button>
        }
      />
      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold text-ink">
            Como exportar da B3
          </DialogTitle>
          <p className="text-[12px] text-ink-3">
            Cada relatório do portal Investidor B3 popula uma parte diferente do investa. Você pode importar vários XLSX juntos (multi-select) — o sistema reconhece por cabeçalho/sheet e direciona automaticamente.
          </p>
        </DialogHeader>

        <div className="overflow-x-auto -mx-2 sm:mx-0 mt-2">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead>
              <tr className="text-ink-3 border-b border-line-soft">
                <th className="text-left font-normal py-2 pr-2 w-[120px]">Relatório</th>
                <th className="text-left font-normal py-2 px-2">Popula no investa</th>
                <th className="text-left font-normal py-2 px-2">Caminho na B3</th>
                <th className="text-left font-normal py-2 pl-2 w-[180px]">Frequência</th>
              </tr>
            </thead>
            <tbody>
              {REPORTS.map((r) => (
                <tr key={r.name} className="border-b border-line-soft last:border-b-0 align-top">
                  <td className="py-3 pr-2 text-ink font-semibold">{r.name}</td>
                  <td className="py-3 px-2 text-ink-2 leading-relaxed">{r.populates}</td>
                  <td className="py-3 px-2 text-ink-2 leading-relaxed font-mono text-[11px]">{r.path}</td>
                  <td className="py-3 pl-2 text-ink-3 leading-relaxed">{r.frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-2 text-[11.5px] text-ink-3 leading-relaxed">
          <p>
            <strong className="text-ink-2">Primeira vez:</strong> importe Posição + Movimentação + Eventos juntos. Negociação opcional (Movimentação já cobre os trades).
          </p>
          <p>
            <strong className="text-ink-2">Re-imports:</strong> seguros. Trades dedupe por <code className="font-mono">data·ticker·side·qty·preço</code>. Proventos dedupe por <code className="font-mono">data·ticker·tipo·valor</code>. Mesmo arquivo 2x = zero entradas novas.
          </p>
          <p>
            <strong className="text-ink-2">Limite B3:</strong> Movimentação cobre até 12 meses. Pra histórico longo (2020-2026), exporte ano a ano e importe em sequência — tudo acumula via dedupe.
          </p>
          <p className="pt-2 border-t border-line-soft">
            Portal:{" "}
            <a
              href="https://www.investidor.b3.com.br/"
              target="_blank"
              rel="noopener"
              className="text-brand-bright underline inline-flex items-center gap-1"
            >
              investidor.b3.com.br <ExternalLink className="w-3 h-3" />
            </a>{" "}
            · login com seu CPF + senha do portal
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
