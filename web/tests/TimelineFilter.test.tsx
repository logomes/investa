import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineFilter } from "@/components/charts/TimelineFilter";

describe("TimelineFilter", () => {
  it("renders the four options", () => {
    render(<TimelineFilter value="10A" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tudo" })).toBeInTheDocument();
  });

  it("marks the current value as active (aria-pressed=true)", () => {
    render(<TimelineFilter value="5A" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "5A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1A" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked option", () => {
    const onChange = vi.fn();
    render(<TimelineFilter value="10A" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "1A" }));
    expect(onChange).toHaveBeenCalledWith("1A");
  });
});
