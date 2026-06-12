"use client";

import { useScenarioStore } from "@/lib/store";

/** Chip shown next to card titles whenever values are in today's money. */
export function DisplayModeBadge() {
  const displayMode = useScenarioStore((s) => s.displayMode);
  if (displayMode !== "real") return null;
  return (
    <span className="text-[10px] font-medium text-brand-bright bg-brand-bright/10 px-1.5 py-0.5 rounded">
      R$ de hoje
    </span>
  );
}
