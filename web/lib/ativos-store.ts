import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AssetPosition } from "./ativos-schema";

const PALETTE = [
  "#5CC8FF", "#FFC857", "#46E8A4", "#FF6B5B",
  "#C39BD3", "#FFB088", "#7DCFFF", "#A2E5C0",
];

type Input = Omit<AssetPosition, "color"> & { color?: string };

type Store = {
  positions: AssetPosition[];
  upsertPosition: (p: Input) => void;
  removePosition: (id: string) => void;
  replaceAllPositions: (positions: AssetPosition[]) => void;
};

export const useAssetsStore = create<Store>()(
  persist(
    (set, get) => ({
      positions: [],
      upsertPosition: (p) => {
        const existing = get().positions.find((x) => x.id === p.id);
        const color = p.color ?? existing?.color ?? PALETTE[get().positions.length % PALETTE.length];
        const newPos: AssetPosition = { ...p, color };
        const positions = existing
          ? get().positions.map((x) => (x.id === p.id ? newPos : x))
          : [...get().positions, newPos];
        set({ positions });
      },
      removePosition: (id) => set({ positions: get().positions.filter((p) => p.id !== id) }),
      replaceAllPositions: (positions) => set({ positions }),
    }),
    {
      name: "investa-assets-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ positions: s.positions }),
      skipHydration: true,
    },
  ),
);
