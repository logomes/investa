import { describe, it, expect, beforeEach } from "vitest";
import { useAssetsStore } from "@/lib/ativos-store";
import type { AssetPosition } from "@/lib/ativos-schema";

const baseInput: Omit<AssetPosition, "color"> = {
  id: "1",
  ticker: "HGCR11",
  assetClass: "FII_PAPEL",
  currency: "BRL",
  quantity: 100,
  avgPrice: 100,
  expectedYield: 0.13,
  capitalGain: 0,
};

describe("ativos-store", () => {
  beforeEach(() => {
    useAssetsStore.setState({ positions: [] });
  });

  it("upsertPosition adiciona com color do PALETTE quando ausente", () => {
    useAssetsStore.getState().upsertPosition(baseInput);
    const positions = useAssetsStore.getState().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(positions[0].ticker).toBe("HGCR11");
  });

  it("upsertPosition edit (mesmo id) mantém color anterior", () => {
    useAssetsStore.getState().upsertPosition(baseInput);
    const colorBefore = useAssetsStore.getState().positions[0].color;
    useAssetsStore.getState().upsertPosition({
      ...baseInput,
      quantity: 200,  // mudou
    });
    const positions = useAssetsStore.getState().positions;
    expect(positions).toHaveLength(1);  // não duplicou
    expect(positions[0].quantity).toBe(200);
    expect(positions[0].color).toBe(colorBefore);
  });

  it("removePosition remove por id", () => {
    useAssetsStore.getState().upsertPosition(baseInput);
    useAssetsStore.getState().upsertPosition({ ...baseInput, id: "2", ticker: "KNCR11" });
    expect(useAssetsStore.getState().positions).toHaveLength(2);
    useAssetsStore.getState().removePosition("1");
    const positions = useAssetsStore.getState().positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe("2");
  });
});
