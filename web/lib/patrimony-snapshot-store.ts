import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PatrimonySnapshot } from "./patrimony-snapshot";

type Store = {
  snapshots: PatrimonySnapshot[];
  // Replace-by-date: capturing twice in the same day overwrites the older
  // snapshot. Avoids accidental dupes when the user clicks twice.
  addSnapshot: (snapshot: PatrimonySnapshot) => void;
  removeSnapshot: (date: string) => void;
  clearSnapshots: () => void;
};

export const usePatrimonySnapshotStore = create<Store>()(
  persist(
    (set, get) => ({
      snapshots: [],
      addSnapshot: (snapshot) => {
        const map = new Map<string, PatrimonySnapshot>();
        for (const s of get().snapshots) map.set(s.date, s);
        map.set(snapshot.date, snapshot);
        const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        set({ snapshots: merged });
      },
      removeSnapshot: (date) => set({ snapshots: get().snapshots.filter((s) => s.date !== date) }),
      clearSnapshots: () => set({ snapshots: [] }),
    }),
    {
      name: "investa-patrimony-snapshots-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
