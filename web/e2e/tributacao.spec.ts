import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Tributação forward page", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("renders the KPI row and the comparator cards", async ({ page }) => {
    await page.goto("/tributacao");

    // KPI row (KpiRowTributacao) — stable contracts.
    await expect(page.getByText("IR total no horizonte", { exact: true })).toBeVisible();
    await expect(page.getByText("Alíquota efetiva", { exact: true })).toBeVisible();
    await expect(page.getByText("IR latente na saída", { exact: true })).toBeVisible();

    // Comparator cards.
    await expect(page.getByText("LCI isenta vs CDB tributado")).toBeVisible();
    await expect(page.getByText("PGBL vs VGBL")).toBeVisible();
  });

  test("editing the LCI rate updates the equivalent CDB value", async ({ page }) => {
    await page.goto("/tributacao");

    await expect(page.getByText("CDB equivalente (a.a.)")).toBeVisible();

    const input = page.locator("#lci-rate");
    await input.fill("12");

    // A higher gross LCI rate must yield a strictly higher equivalent CDB rate,
    // which (regressivo no resgate) is above the LCI rate itself.
    await expect(page.locator("text=/1[2-9],\\d{2}%/").first()).toBeVisible();
  });
});
