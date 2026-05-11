import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissingPositionsBanner } from "@/components/ativos/MissingPositionsBanner";

describe("MissingPositionsBanner", () => {
  it("não renderiza nada quando não há trades nem proventos", () => {
    const { container } = render(<MissingPositionsBanner trades={0} provents={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra contagem de trades quando só há trades", () => {
    render(<MissingPositionsBanner trades={384} provents={0} />);
    expect(screen.getByText(/384 trades/)).toBeInTheDocument();
    expect(screen.queryByText(/proventos pagos/)).not.toBeInTheDocument();
  });

  it("mostra contagem de proventos quando só há proventos", () => {
    render(<MissingPositionsBanner trades={0} provents={503} />);
    expect(screen.getByText(/503 proventos pagos/)).toBeInTheDocument();
    expect(screen.queryByText(/trades/)).not.toBeInTheDocument();
  });

  it("mostra ambos quando há trades e proventos", () => {
    render(<MissingPositionsBanner trades={384} provents={503} />);
    expect(screen.getByText(/384 trades \+ 503 proventos pagos/)).toBeInTheDocument();
  });

  it("link para /ir e /proventos", () => {
    render(<MissingPositionsBanner trades={1} provents={1} />);
    const irLink = screen.getByRole("link", { name: "/ir" });
    const proventosLink = screen.getByRole("link", { name: "/proventos" });
    expect(irLink.getAttribute("href")).toBe("/ir");
    expect(proventosLink.getAttribute("href")).toBe("/proventos");
  });
});
