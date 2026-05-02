"use client";

import { cn } from "@/lib/utils";

export type TimelineValue = "1A" | "5A" | "10A" | "Tudo";

const OPTIONS: TimelineValue[] = ["1A", "5A", "10A", "Tudo"];

type Props = {
  value: TimelineValue;
  onChange: (v: TimelineValue) => void;
};

export function TimelineFilter({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center bg-bg-2 border border-line rounded-pill p-1 gap-1">
      {OPTIONS.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={cn(
              "px-3 py-1 rounded-pill text-[12px] font-medium transition-colors",
              active ? "bg-bg-4 text-ink" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
