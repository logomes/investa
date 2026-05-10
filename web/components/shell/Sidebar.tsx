"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Props = {
  /** When the viewport is below xl, the sidebar is an off-canvas drawer.
   *  This flag controls whether it's visible. Ignored above xl (always shown). */
  mobileOpen?: boolean;
  /** Invoked when the user dismisses the drawer (close button, route change, Esc, backdrop). */
  onClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onClose }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-60 h-screen bg-bg-0 border-r border-line-soft flex flex-col flex-shrink-0",
        // ≥xl: in flow; <xl: fixed off-canvas drawer.
        "xl:relative xl:translate-x-0 xl:transition-none",
        "fixed inset-y-0 left-0 z-40 transition-transform",
        mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
      )}
      aria-hidden={!mobileOpen ? undefined : false}
    >
      {/* Logo + mobile-only close button */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-bg-0 font-bold"
          style={{ background: "linear-gradient(135deg, #2af0c4 0%, #ff6b5b 100%)" }}
        >
          i
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink leading-tight">investa</div>
          <div className="text-[11px] text-ink-3 leading-tight">análise patrimonial</div>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="xl:hidden w-8 h-8 rounded-md hover:bg-bg-2 flex items-center justify-center text-ink-3 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-3 px-3 py-2">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-[10px] text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "bg-bg-3 text-ink shadow-card-left"
                          : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0",
                          isActive ? "text-brand-bright" : "text-ink-3 group-hover:text-ink-2"
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-bright bg-brand-bright/15 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-line-soft p-4 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-bg-0 text-xs font-bold"
          style={{ background: "linear-gradient(135deg, #2af0c4 0%, #ff6b5b 100%)" }}
        >
          L
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-ink leading-tight">Lucas G.</div>
          <div className="text-[11.5px] text-ink-3 leading-tight">Plano Pro · Abr/26</div>
        </div>
      </div>
    </aside>
  );
}
