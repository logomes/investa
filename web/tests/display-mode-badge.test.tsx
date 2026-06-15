import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisplayModeBadge } from "@/components/shell/DisplayModeBadge";
import { useScenarioStore } from "@/lib/store";

describe("DisplayModeBadge", () => {
  beforeEach(() => useScenarioStore.setState({ displayMode: "real" }));

  it("renders the chip in real mode", () => {
    render(<DisplayModeBadge />);
    expect(screen.getByText("R$ de hoje")).toBeInTheDocument();
  });

  it("renders nothing in nominal mode", () => {
    useScenarioStore.setState({ displayMode: "nominal" });
    const { container } = render(<DisplayModeBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
