import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/shell/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/imovel",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className, "aria-current": ariaCurrent }: any) => (
    <a href={href} className={className} aria-current={ariaCurrent}>{children}</a>
  ),
}));

describe("Sidebar", () => {
  it("renders all 8 nav items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Visão Geral")).toBeInTheDocument();
    expect(screen.getByText("Imóvel")).toBeInTheDocument();
    expect(screen.getByText("Carteira")).toBeInTheDocument();
    expect(screen.getByText("Sensibilidade")).toBeInTheDocument();
    expect(screen.getByText("Tributação")).toBeInTheDocument();
    expect(screen.getByText("Risco MC")).toBeInTheDocument();
    expect(screen.getByText("Exportar")).toBeInTheDocument();
    expect(screen.getByText("Renda Fixa")).toBeInTheDocument();
  });

  it("marks the current pathname as active (aria-current=page)", () => {
    render(<Sidebar />);
    const activeLink = screen.getByText("Imóvel").closest("a");
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("renders the user card with hardcoded Lucas G. branding", () => {
    render(<Sidebar />);
    expect(screen.getByText("Lucas G.")).toBeInTheDocument();
    expect(screen.getByText(/Plano Pro/i)).toBeInTheDocument();
  });

  it("renders the MC badge on the Risco item", () => {
    render(<Sidebar />);
    expect(screen.getByText("MC")).toBeInTheDocument();
  });
});
