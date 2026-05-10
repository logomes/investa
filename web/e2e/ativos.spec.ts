import { test, expect } from "@playwright/test";
import { mockBackend, mockQuote } from "./fixtures/api-mocks";

test.describe("Ativos page", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
    // Reset ativos store between tests so order doesn't matter
    await page.addInitScript(() => {
      try { window.localStorage.removeItem("investa-assets-v1"); } catch { /* noop */ }
    });
  });

  test("auto-classify infers Ação BR from PETR4 ticker", async ({ page }) => {
    await mockQuote(page, "PETR4", "BR", 45.67);
    await page.goto("/ativos");

    await page.getByRole("button", { name: "Adicionar" }).click();

    await page.locator("#a-ticker").fill("PETR4");
    await page.locator("#a-qty").fill("100");
    await page.locator("#a-price").fill("40");
    // Trigger blur on ticker so the quote-fetch + classify run
    await page.locator("#a-qty").focus();
    await page.locator("#a-qty").blur();

    await page.getByRole("button", { name: "Salvar" }).click();

    // After save the row appears in the table with the correct class label
    await expect(page.getByText("Ação BR (dividendo)").first()).toBeVisible();
    // Ticker visible in the table
    await expect(page.getByRole("cell", { name: /^PETR4$/ })).toBeVisible();
  });

  test("table shows current price column with relative time", async ({ page }) => {
    // Pre-seed an asset with currentPrice + asOf so the column renders without
    // a fetch round-trip.
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    await page.addInitScript((asOf) => {
      window.localStorage.setItem(
        "investa-assets-v1",
        JSON.stringify({
          state: {
            positions: [{
              id: "1", ticker: "VALE3", assetClass: "ACAO_BR_DIVIDENDO",
              currency: "BRL", quantity: 10, avgPrice: 80,
              expectedYield: 0.08, capitalGain: 0.03, color: "#5CC8FF",
              currentPrice: 81.49, asOf,
            }],
          },
          version: 0,
        }),
      );
    }, tenMinAgo);

    await page.goto("/ativos");
    await expect(page.getByText("R$ 81")).toBeVisible(); // formatRs rounds to "R$ 81"
    await expect(page.getByText(/há 10 min/i)).toBeVisible();
  });
});
