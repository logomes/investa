import { describe, it, expect, beforeEach } from "vitest";
import { usePatrimonySnapshotStore } from "@/lib/patrimony-snapshot-store";
import type { PatrimonySnapshot } from "@/lib/patrimony-snapshot";

function snap(overrides: Partial<PatrimonySnapshot> & { date: string }): PatrimonySnapshot {
  return {
    totalBRL: 100_000,
    rendaVariavel: 70_000,
    rendaFixa: 30_000,
    positionsCount: 5,
    rfCount: 2,
    ...overrides,
  };
}

describe("usePatrimonySnapshotStore", () => {
  beforeEach(() => {
    usePatrimonySnapshotStore.setState({ snapshots: [] });
  });

  it("addSnapshot adiciona ordenado por data crescente", () => {
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-05-11" }));
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-04-30" }));
    const list = usePatrimonySnapshotStore.getState().snapshots;
    expect(list).toHaveLength(2);
    expect(list[0].date).toBe("2026-04-30");
    expect(list[1].date).toBe("2026-05-11");
  });

  it("mesma data sobrescreve (replace-by-date)", () => {
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-05-11", totalBRL: 100 }));
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-05-11", totalBRL: 200 }));
    const list = usePatrimonySnapshotStore.getState().snapshots;
    expect(list).toHaveLength(1);
    expect(list[0].totalBRL).toBe(200);
  });

  it("removeSnapshot por data", () => {
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-05-11" }));
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-04-30" }));
    usePatrimonySnapshotStore.getState().removeSnapshot("2026-05-11");
    const list = usePatrimonySnapshotStore.getState().snapshots;
    expect(list).toHaveLength(1);
    expect(list[0].date).toBe("2026-04-30");
  });

  it("clearSnapshots zera o array", () => {
    usePatrimonySnapshotStore.getState().addSnapshot(snap({ date: "2026-05-11" }));
    usePatrimonySnapshotStore.getState().clearSnapshots();
    expect(usePatrimonySnapshotStore.getState().snapshots).toEqual([]);
  });
});
