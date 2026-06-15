import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("portfolio bridge", () => {
  test("imports the real portfolio into the scenario drawer", async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "investa-assets-v1",
        JSON.stringify({
          state: {
            positions: [{
              id: "HGLG11", ticker: "HGLG11", assetClass: "FII", currency: "BRL",
              quantity: 100, avgPrice: 100, expectedYield: 0.11, capitalGain: 0.01,
              color: "#FFC857",
            }],
            scheduledEvents: [], trades: [], proventsPaid: [],
          },
          version: 0,
        }),
      );
    });
    // Use a full load on /ativos so AtivosPageContent calls useAssetsStore.persist.rehydrate().
    // Then client-side navigate to / so the Zustand store state is preserved in memory
    // (full page.goto("/") would reset the JS runtime and lose the rehydrated store).
    await page.goto("/ativos");
    await expect(page.getByRole("cell", { name: "HGLG11", exact: true }).first()).toBeVisible();

    // Client-side navigation via the sidebar link keeps Zustand state alive.
    await page.getByRole("link", { name: "Visão Geral" }).click();
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: /Simular cenário/i }).click();
    await page.getByRole("button", { name: /Usar carteira real/i }).click();

    // The preview panel shows the total capital — scope to the preview block
    const preview = page.locator(".bg-bg-3.border.border-line.rounded-card");
    await expect(preview.getByText(/R\$\s*10\.000/)).toBeVisible();

    await page.getByRole("button", { name: /Substituir cenário/i }).click();
    await expect(page.getByText("FII (Papel/Tijolo/Agro/FoF)")).toBeVisible();
  });
});
