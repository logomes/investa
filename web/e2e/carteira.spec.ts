import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Carteira page", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("renders allocation donut + table with the default 5 portfolio assets", async ({ page }) => {
    await page.goto("/carteira");

    // Default portfolio (defaults.ts) has 5 named assets; the donut/table label them.
    await expect(page.getByText(/FIIs de Papel/i).first()).toBeVisible();
    await expect(page.getByText(/FIIs de Tijolo/i).first()).toBeVisible();
    await expect(page.getByText(/Ações BR Dividendos/i).first()).toBeVisible();

    // The 4 KPIs of /carteira are stable contracts.
    await expect(page.getByText("DY blended", { exact: true })).toBeVisible();
    await expect(page.getByText("Ganho de capital esp.", { exact: true })).toBeVisible();
    await expect(page.getByText("Retorno total a.a.", { exact: true })).toBeVisible();
    await expect(page.getByText("Renda anual estimada", { exact: true })).toBeVisible();
  });
});
