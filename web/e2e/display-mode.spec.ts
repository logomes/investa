import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("display mode toggle", () => {
  test("nominal mode raises the evolution chart's last value", async ({ page }) => {
    await mockBackend(page);
    // viewport is 1440x900 per playwright.config.ts — toggle (hidden lg:flex) is visible
    await page.goto("/");

    await expect(page.getByText("Evolução do patrimônio")).toBeVisible();

    // In real mode (default), portfolio last-value (year 10, ipca=4.5%):
    //   588_000 / 1.045^10 ≈ 378_766 → label "R$379k"
    // In nominal mode:
    //   588_000 → label "R$588k"
    // SVG last-value labels have font-weight="700" and no text-anchor (y-axis labels
    // have text-anchor="end"). We target via the text content itself.
    await expect(page.locator("text=R$379k")).toBeVisible();

    // Switch to Nominal
    await page.getByRole("button", { name: "Nominal" }).click();

    // Real-mode value gone, nominal value appears
    await expect(page.locator("text=R$379k")).not.toBeVisible();
    await expect(page.locator("text=R$588k")).toBeVisible();
  });
});
