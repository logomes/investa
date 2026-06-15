"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, Sparkles } from "lucide-react";
import { NAV_BY_HREF } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { useScenarioStore } from "@/lib/store";

function deriveTitle(pathname: string): string {
  if (pathname === "/") return "Visão geral";
  const item = NAV_BY_HREF[pathname];
  return item?.label ?? "investa";
}

type Props = {
  /** Invoked when the hamburger is clicked (only visible below xl). */
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: Props) {
  const pathname = usePathname();
  const title = deriveTitle(pathname);
  const setDrawerOpen = useScenarioStore((s) => s.setDrawerOpen);
  const horizon = useScenarioStore((s) => s.scenario.horizon);
  const searchRef = useRef<HTMLInputElement>(null);
  // Default false → SSR and first client render show "Ctrl K". Effect upgrades
  // to ⌘K on Mac post-hydration without mismatch.
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const platform =
      navigator.platform ||
      // Chromium-only modern API; fine to skip on Firefox/Safari.
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ||
      "";
    setIsMac(/Mac|iPhone|iPad/i.test(platform));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "k" && e.key !== "K") return;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMac]);

  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  return (
    <header className="h-16 sticky top-0 z-10 backdrop-blur-[8px] bg-bg-1/60 border-b border-line-soft flex items-center px-4 sm:px-6 gap-3">
      {onMenuClick && (
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={onMenuClick}
          className="xl:hidden w-9 h-9 -ml-1 rounded-lg hover:bg-bg-2 flex items-center justify-center text-ink-2 hover:text-ink"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Title + breadcrumb */}
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-[19px] font-bold tracking-[-0.015em] text-ink leading-tight truncate">
          {title}
        </h1>
        <p className="text-[12.5px] text-ink-3 leading-tight truncate">
          Análise · Carteira vs Benchmark · {horizon} anos
        </p>
      </div>

      {/* Search — hidden on small to give the title room; visible from md up */}
      <div className="hidden md:flex flex-1 justify-center">
        <div className="relative w-full max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar ativos, parâmetros..."
            className="w-full bg-bg-2 border border-line rounded-pill text-[14px] text-ink placeholder:text-ink-3 pl-9 pr-16 py-2 focus:outline-none focus:ring-2 focus:ring-brand-bright/40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-3 bg-bg-3 px-1.5 py-0.5 rounded">
            {shortcutLabel}
          </span>
        </div>
      </div>

      {/* Push actions to the right when search is hidden */}
      <div className="flex-1 md:hidden" />

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <Button
          onClick={() => setDrawerOpen(true)}
          className="h-[38px] rounded-[10px] text-bg-0 font-semibold shadow-glow hover:scale-[1.02] transition-transform"
          style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Simular cenário</span>
          <span className="sm:hidden">Simular</span>
        </Button>
      </div>
    </header>
  );
}
