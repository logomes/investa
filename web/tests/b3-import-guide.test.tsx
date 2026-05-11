import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { B3ImportGuide } from "@/components/ativos/B3ImportGuide";

describe("B3ImportGuide", () => {
  it("renderiza apenas o botão trigger por padrão (dialog fechado)", () => {
    render(<B3ImportGuide />);
    expect(screen.getByRole("button", { name: "Como exportar da B3?" })).toBeInTheDocument();
    expect(screen.queryByText("Como exportar da B3")).not.toBeInTheDocument();
  });

  it("abre o dialog com os 4 relatórios ao clicar no botão", async () => {
    render(<B3ImportGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Como exportar da B3?" }));
    // base-ui Dialog renders via portal — aguarda o conteúdo aparecer
    await screen.findByText("Como exportar da B3");
    expect(screen.getByText("Posição")).toBeInTheDocument();
    expect(screen.getByText("Movimentação")).toBeInTheDocument();
    expect(screen.getByText("Negociação")).toBeInTheDocument();
    expect(screen.getByText("Eventos")).toBeInTheDocument();
  });

  it("inclui menção a dedupe re-import seguro", async () => {
    render(<B3ImportGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Como exportar da B3?" }));
    await screen.findByText("Como exportar da B3");
    expect(screen.getByText(/Re-imports/)).toBeInTheDocument();
    expect(screen.getAllByText(/dedupe/).length).toBeGreaterThanOrEqual(1);
  });

  it("link externo para investidor.b3.com.br", async () => {
    render(<B3ImportGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Como exportar da B3?" }));
    await screen.findByText("Como exportar da B3");
    const link = screen.getByRole("link", { name: /investidor\.b3\.com\.br/ });
    expect(link.getAttribute("href")).toBe("https://www.investidor.b3.com.br/");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
