import { test, expect, type Page } from "@playwright/test";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];
const portfolioAnnualIncome = [0, 21_000, 23_000, 26_000, 29_000, 32_000, 36_000, 40_000, 45_000, 50_000, 56_000];
const realEstatePatrimony = [230_000, 245_000, 261_000, 278_000, 296_000, 315_000, 335_000, 357_000, 380_000, 405_000, 431_000];
const realEstateAnnualIncome = [9_000, 10_000, 10_500, 11_000, 11_500, 12_000, 12_500, 13_000, 13_500, 14_000, 14_500];

const simulateOut = {
  realEstate: {
    label: "Imóvel",
    color: "#FF6B5B",
    years,
    patrimony: realEstatePatrimony,
    annualIncome: realEstateAnnualIncome,
    cumulativeIncome: realEstateAnnualIncome.map((_, i) => realEstateAnnualIncome.slice(0, i + 1).reduce((a, b) => a + b, 0)),
  },
  portfolio: {
    label: "Carteira Diversificada",
    color: "#5CC8FF",
    years,
    patrimony: portfolioPatrimony,
    annualIncome: portfolioAnnualIncome,
    cumulativeIncome: portfolioAnnualIncome.map((_, i) => portfolioAnnualIncome.slice(0, i + 1).reduce((a, b) => a + b, 0)),
  },
  benchmark: {
    label: "Tesouro Selic (líquido)",
    color: "#FFC857",
    years,
    patrimony: [230_000, 258_000, 289_000, 324_000, 364_000, 408_000, 458_000, 513_000, 576_000, 646_000, 725_000],
    annualIncome: [28_000, 28_000, 31_000, 35_000, 39_000, 44_000, 49_000, 55_000, 62_000, 70_000, 78_000],
    cumulativeIncome: [28_000, 56_000, 87_000, 122_000, 161_000, 205_000, 254_000, 309_000, 371_000, 441_000, 519_000],
  },
  sensitivity: [],
  taxComparison: [],
};

// finalDistribution: 100 samples, ~half above 600k → prob ~0.5
const finalDistribution = Array.from({ length: 100 }, (_, i) => 400_000 + i * 4_000);
const mcOut = {
  realEstate: {
    label: "Imóvel",
    color: "#FF6B5B",
    p10: realEstatePatrimony.map((v) => v * 0.85),
    p50: realEstatePatrimony,
    p90: realEstatePatrimony.map((v) => v * 1.15),
    finalDistribution: finalDistribution.map((v) => v * 0.7),
    maxDrawdowns: Array.from({ length: 100 }, () => -0.04),
  },
  portfolio: {
    label: "Carteira Diversificada",
    color: "#5CC8FF",
    p10: portfolioPatrimony.map((v) => v * 0.85),
    p50: portfolioPatrimony,
    p90: portfolioPatrimony.map((v) => v * 1.15),
    finalDistribution,
    maxDrawdowns: Array.from({ length: 100 }, () => -0.026),
  },
};

const macroOut = {
  selic: 0.105,
  cdi: 0.104,
  ipca: 0.045,
  usdBrl: 5.2,
  isStale: false,
  sourceLabel: "BCB · 2026-05-09",
};

async function mockApi(page: Page) {
  await page.route(
    (url) => url.pathname.endsWith("/api/macro"),
    (route) => route.fulfill({ json: macroOut }),
  );
  await page.route(
    (url) => url.pathname.endsWith("/api/simulate/monte-carlo"),
    (route) => route.fulfill({ json: mcOut }),
  );
  await page.route(
    (url) => url.pathname.endsWith("/api/simulate"),
    (route) => route.fulfill({ json: simulateOut }),
  );
}

test.describe("Visão Geral smoke", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
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
