"use client";

import { CalendarClock } from "lucide-react";
import type { B3ScheduledEvent } from "@/lib/b3-import";
import { formatRs2 } from "@/lib/format";

type Props = {
  events: B3ScheduledEvent[];
};

export function ScheduledEventsBanner({ events }: Props) {
  if (events.length === 0) return null;

  const total = events.reduce((sum, e) => sum + e.netValue, 0);
  const sorted = [...events].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const next = sorted[0];
  const last = sorted[sorted.length - 1];
  const tickerCount = new Set(events.map((e) => e.ticker)).size;

  return (
    <div className="bg-bg-2 border border-line rounded-card p-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-full bg-brand-bright/15 flex items-center justify-center flex-shrink-0">
        <CalendarClock className="w-5 h-5 text-brand-bright" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-tight">
          Renda agendada · {formatRs2(total)}
        </p>
        <p className="text-[11.5px] text-ink-3 mt-0.5">
          {events.length} pagamentos · {tickerCount} ativos · {formatBrDate(next.paymentDate)} → {formatBrDate(last.paymentDate)}
        </p>
      </div>
    </div>
  );
}

function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
