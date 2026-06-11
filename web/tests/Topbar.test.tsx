import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shell/Topbar";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  horizon: 10,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/lib/store", () => ({
  useScenarioStore: <T,>(selector: (s: { scenario: { horizon: number }; setDrawerOpen: (v: boolean) => void }) => T) =>
    selector({ scenario: { horizon: mocks.horizon }, setDrawerOpen: () => {} }),
}));

describe("Topbar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.horizon = 10;
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
});
