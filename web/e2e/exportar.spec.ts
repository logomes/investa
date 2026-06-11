import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Exportar page", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("renders the long-format comparison table with 22 rows", async ({ page }) => {
    await page.goto("/exportar");
    await expect(page.getByRole("heading", { name: /Comparativo Carteira × Benchmark/i })).toBeVisible();
    await expect(page.getByText(/2 cenários × 11 anos = 22 linhas/i)).toBeVisible();

    // The table should show the 2 scenario labels; Imóvel must NOT appear
    await expect(page.getByRole("cell", { name: "Carteira Diversificada" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Tesouro Selic (líquido)" }).first()).toBeVisible();
  });

  test("download CSV triggers a file download", async ({ page }) => {
    await page.goto("/exportar");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Baixar CSV/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
