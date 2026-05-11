import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AssetPosition } from "./ativos-schema";
import type { B3PaidProvent, B3ScheduledEvent, B3Trade } from "./b3-import";

const PALETTE = [
  "#5CC8FF", "#FFC857", "#46E8A4", "#FF6B5B",
  "#C39BD3", "#FFB088", "#7DCFFF", "#A2E5C0",
];

type Input = Omit<AssetPosition, "color"> & { color?: string };

type Store = {
  positions: AssetPosition[];
  scheduledEvents: B3ScheduledEvent[];
  trades: B3Trade[];
  proventsPaid: B3PaidProvent[];
  upsertPosition: (p: Input) => void;
  removePosition: (id: string) => void;
  replaceAllPositions: (positions: AssetPosition[]) => void;
  replaceScheduledEvents: (events: B3ScheduledEvent[]) => void;
  mergeTrades: (trades: B3Trade[]) => void;
  clearTrades: () => void;
  mergeProventsPaid: (provents: B3PaidProvent[]) => void;
  clearProventsPaid: () => void;
};

function tradeKey(t: B3Trade): string {
  // Signature for dedupe across overlapping import windows.
  return `${t.date}|${t.ticker.toUpperCase()}|${t.side}|${t.quantity}|${t.price}`;
}

function proventKey(p: B3PaidProvent): string {
  // Same date + ticker + type + netValue almost certainly represent the same
  // payment across overlapping Movimentação exports.
  return `${p.paidDate}|${p.ticker.toUpperCase()}|${p.type.toUpperCase()}|${p.netValue.toFixed(2)}`;
}

export const useAssetsStore = create<Store>()(
  persist(
    (set, get) => ({
      positions: [],
      scheduledEvents: [],
      trades: [],
      proventsPaid: [],
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
      replaceScheduledEvents: (events) => set({ scheduledEvents: events }),
      mergeTrades: (incoming) => {
        const existing = get().trades;
        const map = new Map<string, B3Trade>();
        for (const t of existing) map.set(tradeKey(t), t);
        for (const t of incoming) map.set(tradeKey(t), t); // last-write-wins on key collision
        const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        set({ trades: merged });
      },
      clearTrades: () => set({ trades: [] }),
      mergeProventsPaid: (incoming) => {
        const existing = get().proventsPaid;
        const map = new Map<string, B3PaidProvent>();
        for (const p of existing) map.set(proventKey(p), p);
        for (const p of incoming) map.set(proventKey(p), p);
        const merged = Array.from(map.values()).sort((a, b) => a.paidDate.localeCompare(b.paidDate));
        set({ proventsPaid: merged });
      },
      clearProventsPaid: () => set({ proventsPaid: [] }),
    }),
    {
      name: "investa-assets-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        positions: s.positions,
        scheduledEvents: s.scheduledEvents,
        trades: s.trades,
        proventsPaid: s.proventsPaid,
      }),
      skipHydration: true,
    },
  ),
);
