import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Exportar page", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("renders the long-format comparison table with 33 rows", async ({ page }) => {
    await page.goto("/exportar");
    await expect(page.getByRole("heading", { name: /Comparativo Imóvel × Carteira × Tesouro/i })).toBeVisible();
    await expect(page.getByText(/3 cenários × 11 anos = 33 linhas/i)).toBeVisible();

    // The table should show all 3 scenario labels somewhere
    await expect(page.getByRole("cell", { name: "Carteira Diversificada" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Imóvel" }).first()).toBeVisible();
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
