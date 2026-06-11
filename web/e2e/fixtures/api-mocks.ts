import type { Page } from "@playwright/test";

const years = Array.from({ length: 11 }, (_, i) => i);
const portfolioPatrimony = [230_000, 252_000, 277_000, 304_000, 334_000, 367_000, 403_000, 443_000, 487_000, 535_000, 588_000];
const portfolioAnnualIncome = [0, 21_000, 23_000, 26_000, 29_000, 32_000, 36_000, 40_000, 45_000, 50_000, 56_000];

const cumulative = (arr: number[]) => arr.map((_, i) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0));

export const simulateOut = {
  portfolio: {
    label: "Carteira Diversificada",
    color: "#5CC8FF",
    years,
    patrimony: portfolioPatrimony,
    annualIncome: portfolioAnnualIncome,
    cumulativeIncome: cumulative(portfolioAnnualIncome),
  },
  benchmark: {
    label: "CDI (líquido)",
    color: "#FFC857",
    years,
    patrimony: [230_000, 258_000, 289_000, 324_000, 364_000, 408_000, 458_000, 513_000, 576_000, 646_000, 725_000],
    annualIncome: [28_000, 28_000, 31_000, 35_000, 39_000, 44_000, 49_000, 55_000, 62_000, 70_000, 78_000],
    cumulativeIncome: [28_000, 56_000, 87_000, 122_000, 161_000, 205_000, 254_000, 309_000, 371_000, 441_000, 519_000],
  },
  sensitivity: [],
  taxComparison: [],
};

const finalDistribution = Array.from({ length: 100 }, (_, i) => 400_000 + i * 4_000);

export const mcOut = {
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

export const macroOut = {
  selic: 0.105,
  cdi: 0.104,
  ipca: 0.045,
  usdBrl: 5.2,
  isStale: false,
  sourceLabel: "BCB · 2026-05-09",
};

export async function mockBackend(page: Page): Promise<void> {
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

export async function mockQuote(page: Page, ticker: string, market: "BR" | "US", price: number): Promise<void> {
  await page.route(
    (url) => url.pathname.endsWith("/api/quotes") && url.searchParams.get("ticker") === ticker,
    (route) =>
      route.fulfill({
        json: {
          ticker,
          market,
          price,
          currency: market === "BR" ? "BRL" : "USD",
          asOf: new Date(Date.now() - 60_000).toISOString(),
          source: market === "BR" ? "brapi" : "yahoo",
        },
      }),
  );
}
