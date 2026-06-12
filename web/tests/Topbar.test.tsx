import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shell/Topbar";
import type { DisplayMode } from "@/lib/api-types";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  horizon: 10,
  displayMode: "real" as DisplayMode,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/lib/store", () => {
  type StoreShape = {
    scenario: { horizon: number };
    setDrawerOpen: (v: boolean) => void;
    displayMode: DisplayMode;
    setDisplayMode: (m: DisplayMode) => void;
  };

  const selector = <T,>(fn: (s: StoreShape) => T): T =>
    fn({
      scenario: { horizon: mocks.horizon },
      setDrawerOpen: () => {},
      get displayMode() {
        return mocks.displayMode;
      },
      setDisplayMode: (m: DisplayMode) => {
        mocks.displayMode = m;
      },
    });

  selector.getState = () => ({ displayMode: mocks.displayMode });

  return { useScenarioStore: selector };
});

describe("Topbar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.horizon = 10;
    mocks.displayMode = "real";
  });

  it("derives the title from the pathname (Visão Geral on root)", () => {
    mocks.pathname = "/";
    render(<Topbar />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Visão geral");
  });

  it("derives the title for /renda-fixa", () => {
    mocks.pathname = "/renda-fixa";
    render(<Topbar />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Renda Fixa");
  });

  it("renders the search input with OS-aware shortcut hint (Ctrl K on non-Mac jsdom)", () => {
    render(<Topbar />);
    expect(screen.getByPlaceholderText(/Buscar/i)).toBeInTheDocument();
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });

  it("Ctrl+K focuses the search input", () => {
    render(<Topbar />);
    const input = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("renders the 'Simular cenário' CTA button", () => {
    render(<Topbar />);
    expect(screen.getByRole("button", { name: /Simular cenário/i })).toBeInTheDocument();
  });

  it("subtitle shows carteira vs benchmark with the scenario horizon", () => {
    mocks.horizon = 25;
    render(<Topbar />);
    expect(screen.getByText(/Carteira vs Benchmark · 25 anos/)).toBeInTheDocument();
  });

  it("display-mode toggle flips the store", () => {
    render(<Topbar />);
    fireEvent.click(screen.getByRole("button", { name: /^Nominal$/i }));
    expect(mocks.displayMode).toBe("nominal");
    fireEvent.click(screen.getByRole("button", { name: /R\$ de hoje/i }));
    expect(mocks.displayMode).toBe("real");
  });
});
