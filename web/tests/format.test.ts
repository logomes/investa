import { describe, it, expect } from "vitest";
import { formatRsK, formatPercent, formatSignedDelta } from "@/lib/format";

describe("formatters", () => {
  it("formatRsK formats values as 'R$ XXk' with rounding", () => {
    expect(formatRsK(641_000)).toBe("R$ 641k");
    expect(formatRsK(1_234_567)).toBe("R$ 1.235k");
    expect(formatRsK(0)).toBe("R$ 0k");
  });

  it("formatPercent formats decimal as 'XX,X%' with comma decimal", () => {
    expect(formatPercent(0.108)).toBe("10,8%");
    expect(formatPercent(0.0142)).toBe("1,4%");
    expect(formatPercent(-0.142)).toBe("-14,2%");
  });

  it("formatSignedDelta prepends + or - and uses comma decimal", () => {
    expect(formatSignedDelta(670, "currency")).toBe("+R$ 670");
    expect(formatSignedDelta(-1500, "currency")).toBe("-R$ 1.500");
    expect(formatSignedDelta(0.108, "percent")).toBe("+10,80% a.a.");
    expect(formatSignedDelta(-0.05, "percent")).toBe("-5,00% a.a.");
  });
});
