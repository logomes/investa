import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FixedIncomePosition } from "./fi-schema";

const PALETTE = [
  "#3498DB", "#E67E22", "#9B59B6", "#1ABC9C",
  "#E74C3C", "#16A085", "#F39C12", "#34495E",
];

type PositionInput = Omit<FixedIncomePosition, "color"> & { color?: string };

type FixedIncomeStore = {
  positions: FixedIncomePosition[];
  upsertPosition: (p: PositionInput) => void;
  removePosition: (id: string) => void;
  replaceAllPositions: (positions: FixedIncomePosition[]) => void;
};

export const useFixedIncomeStore = create<FixedIncomeStore>()(
  persist(
    (set, get) => ({
      positions: [],

      upsertPosition: (p) => {
        const existing = get().positions.find((x) => x.id === p.id);
        const color =
          p.color ?? existing?.color ?? PALETTE[get().positions.length % PALETTE.length];
        const newPos: FixedIncomePosition = { ...p, color };
        const positions = existing
          ? get().positions.map((x) => (x.id === p.id ? newPos : x))
          : [...get().positions, newPos];
        set({ positions });
      },

      removePosition: (id) =>
        set({ positions: get().positions.filter((p) => p.id !== id) }),

      replaceAllPositions: (positions) => set({ positions }),
    }),
    {
      name: "investa-fixed-income-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
