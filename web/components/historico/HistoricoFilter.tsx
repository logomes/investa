"use client";

import { cn } from "@/lib/utils";
import {
  PATRIMONY_RANGES,
  PATRIMONY_RANGE_LABEL,
  type PatrimonyRange,
} from "@/lib/patrimony-snapshot";

type Props = {
  value: PatrimonyRange;
  onChange: (v: PatrimonyRange) => void;
};

export function HistoricoFilter({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center bg-bg-2 border border-line rounded-pill p-1 gap-1">
      {PATRIMONY_RANGES.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={cn(
              "px-3 py-1 rounded-pill text-[12px] font-medium transition-colors",
              active ? "bg-bg-4 text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {PATRIMONY_RANGE_LABEL[opt]}
          </button>
        );
      })}
    </div>
  );
}
