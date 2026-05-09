import { describe, it, expect } from "vitest";
import { relativeTime } from "@/lib/relative-time";

const now = new Date("2026-05-09T12:00:00Z");

describe("relativeTime", () => {
  it("retorna 'agora' quando diff < 1 min", () => {
    expect(relativeTime("2026-05-09T11:59:30Z", now)).toBe("agora");
  });

  it("retorna 'há N min' quando 1 ≤ diff < 60 min", () => {
    expect(relativeTime("2026-05-09T11:55:00Z", now)).toBe("há 5 min");
    expect(relativeTime("2026-05-09T11:01:00Z", now)).toBe("há 59 min");
  });

  it("retorna 'há N h' quando 1 ≤ diff < 24 h", () => {
    expect(relativeTime("2026-05-09T09:00:00Z", now)).toBe("há 3 h");
    expect(relativeTime("2026-05-08T13:00:00Z", now)).toBe("há 23 h");
  });

  it("retorna 'há N d' quando diff ≥ 24 h", () => {
    expect(relativeTime("2026-05-08T11:00:00Z", now)).toBe("há 1 d");
    expect(relativeTime("2026-05-02T12:00:00Z", now)).toBe("há 7 d");
  });
});
