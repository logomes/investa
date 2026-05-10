import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Visão Geral smoke", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("renders the four KPI cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Patrimônio projetado · 10a", { exact: true })).toBeVisible();
    await expect(page.getByText("Renda mensal estimada", { exact: true })).toBeVisible();
    await expect(page.getByText("Probabilidade de meta", { exact: true })).toBeVisible();
    await expect(page.getByText("Drawdown médio", { exact: true })).toBeVisible();
  });

  test("editing the goal updates the card and the KPI", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Editar meta" });
    await expect(button).toContainText("R$ 600.000");
    await button.click();

    const input = page.getByRole("spinbutton", { name: "Editar meta" });
    await input.fill("850000");
    await input.press("Enter");

    await expect(page.getByRole("button", { name: "Editar meta" })).toContainText("R$ 850.000");
    await expect(page.getByText("Monte Carlo · meta R$ 850k")).toBeVisible();
  });
});
