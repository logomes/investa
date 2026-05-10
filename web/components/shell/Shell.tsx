"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ScenarioDrawer } from "@/components/scenario-drawer/ScenarioDrawer";

/**
 * Outer chrome that owns the responsive sidebar drawer state. On viewports
 * ≥1280px the sidebar is in normal flow; below that it slides in over the
 * content from the left when the topbar hamburger is clicked.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close on route change so a click on a nav item dismisses the drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navOpen]);

  return (
    <div className="shell-grid relative z-[1] flex min-h-screen">
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 xl:hidden"
        />
      )}
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setNavOpen(true)} />
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
      <ScenarioDrawer />
    </div>
  );
}
