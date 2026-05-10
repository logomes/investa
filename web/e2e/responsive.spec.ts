import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures/api-mocks";

test.describe("Responsive shell (tablet 820x1180)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockBackend(page);
  });

  test("sidebar starts hidden, hamburger opens it, Esc closes", async ({ page }) => {
    await page.goto("/");

    // Sidebar starts off-canvas (translate-x-full); the link should not be hit-testable.
    const visaoGeralLink = page.getByRole("link", { name: /Visão Geral/i });
    await expect(visaoGeralLink).not.toBeInViewport();

    // Click hamburger → sidebar slides in.
    await page.getByRole("button", { name: /Abrir menu/i }).click();
    await expect(visaoGeralLink).toBeInViewport();

    // Esc closes.
    await page.keyboard.press("Escape");
    await expect(visaoGeralLink).not.toBeInViewport();
  });

  test("clicking a nav link closes the drawer (route change)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Abrir menu/i }).click();
    await page.getByRole("link", { name: /Carteira/i }).click();

    await expect(page).toHaveURL(/\/carteira/);
    // After navigation the drawer should be closed (sidebar off-canvas again).
    await expect(page.getByRole("link", { name: /Visão Geral/i })).not.toBeInViewport();
  });

  test("backdrop click closes the drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Abrir menu/i }).click();
    await page.getByRole("button", { name: /Fechar menu/i }).first().click();
    await expect(page.getByRole("link", { name: /Visão Geral/i })).not.toBeInViewport();
  });
});

test.describe("Responsive KPI grid", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("at sm (800px) the four KPI cards stack 2 columns", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1180 });
    await page.goto("/");
    await page.getByText("Patrimônio projetado", { exact: false }).first().waitFor();
    const kpiCard = page.getByText("Patrimônio projetado", { exact: false }).first();
    const grid = await kpiCard.evaluate((el) => {
      const row = el.closest(".grid") as HTMLElement | null;
      return row ? getComputedStyle(row).gridTemplateColumns : "";
    });
    expect(grid.split(" ").length).toBe(2);
  });

  test("at xl (1440px) the four KPI cards are 4 columns wide", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByText("Patrimônio projetado", { exact: false }).first().waitFor();
    const kpiCard = page.getByText("Patrimônio projetado", { exact: false }).first();
    const grid = await kpiCard.evaluate((el) => {
      const row = el.closest(".grid") as HTMLElement | null;
      return row ? getComputedStyle(row).gridTemplateColumns : "";
    });
    expect(grid.split(" ").length).toBe(4);
  });
});

test.describe("Desktop shell (1440x900)", () => {
  test.beforeEach(async ({ page }) => {
    // Default project viewport is already 1440x900 from playwright.config.ts.
    await mockBackend(page);
  });

  test("sidebar is always visible on ≥xl, hamburger is hidden", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Visão Geral/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Abrir menu/i })).not.toBeVisible();
  });
});
