import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConstructionCard } from "@/components/placeholder/ConstructionCard";

describe("ConstructionCard", () => {
  it("renders the page title", () => {
    render(<ConstructionCard pageTitle="Imóvel" fase={5} />);
    expect(screen.getByText(/Imóvel/i)).toBeInTheDocument();
  });

  it("mentions the target fase", () => {
    render(<ConstructionCard pageTitle="Carteira" fase={5} />);
    expect(screen.getByText(/Fase 5/i)).toBeInTheDocument();
  });

  it("uses 'Em construção' as the heading", () => {
    render(<ConstructionCard pageTitle="X" fase={3} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Em construção/i);
  });
});
