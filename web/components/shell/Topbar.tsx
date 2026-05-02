"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Settings, Sparkles } from "lucide-react";
import { NAV_BY_HREF } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { useScenarioStore } from "@/lib/store";

function deriveTitle(pathname: string): string {
  if (pathname === "/") return "Visão geral";
  const item = NAV_BY_HREF[pathname];
  return item?.label ?? "investa";
}

export function Topbar() {
  const pathname = usePathname();
  const title = deriveTitle(pathname);
  const setDrawerOpen = useScenarioStore((s) => s.setDrawerOpen);

  return (
    <header className="h-16 sticky top-0 z-10 backdrop-blur-[8px] bg-bg-1/60 border-b border-line-soft flex items-center px-6 gap-4">
      {/* Title + breadcrumb */}
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-[19px] font-bold tracking-[-0.015em] text-ink leading-tight truncate">
          {title}
        </h1>
        <p className="text-[12.5px] text-ink-3 leading-tight truncate">
          Análise · Imóvel vs Carteira · 10 anos
        </p>
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <input
            type="search"
            placeholder="Buscar ativos, parâmetros..."
            className="w-full bg-bg-2 border border-line rounded-pill text-[14px] text-ink placeholder:text-ink-3 pl-9 pr-12 py-2 focus:outline-none focus:ring-2 focus:ring-brand-bright/40"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-3 bg-bg-3 px-1.5 py-0.5 rounded">
            ⌘K
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          aria-label="Notificações"
          className="relative w-[38px] h-[38px] rounded-[10px] bg-bg-2 border border-line flex items-center justify-center text-ink-2 hover:bg-bg-3 hover:text-ink transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-green" />
        </button>
        <button
          aria-label="Configurações"
          className="w-[38px] h-[38px] rounded-[10px] bg-bg-2 border border-line flex items-center justify-center text-ink-2 hover:bg-bg-3 hover:text-ink transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="h-[38px] rounded-[10px] text-bg-0 font-semibold shadow-glow hover:scale-[1.02] transition-transform"
          style={{ background: "linear-gradient(135deg, #2af0c4 0%, #00b894 100%)" }}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Simular cenário
        </Button>
      </div>
    </header>
  );
}
