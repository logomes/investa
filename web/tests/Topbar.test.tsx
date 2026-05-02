import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "@/components/shell/Topbar";

const mocks = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

describe("Topbar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
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

  it("renders the search input with ⌘K hint", () => {
    render(<Topbar />);
    expect(screen.getByPlaceholderText(/Buscar/i)).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders the 'Simular cenário' CTA button", () => {
    render(<Topbar />);
    expect(screen.getByRole("button", { name: /Simular cenário/i })).toBeInTheDocument();
  });
});
