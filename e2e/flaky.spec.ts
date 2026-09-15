import { expect, test } from "@playwright/test";

test.describe("flaky tests page", () => {
  test("ranks tests with the flakiest first and marks quarantined ones", async ({ page }) => {
    await page.goto("/flaky");
    await expect(page.getByText("2 flaky of 8 tests")).toBeVisible();
    await expect(page.getByTestId("trend-chart")).toBeVisible();

    const rows = page.getByTestId("flaky-row");
    await expect(rows).toHaveCount(8);
    await expect(rows.nth(0)).toContainText("CheckoutTest#appliesCoupon");
    await expect(rows.nth(0)).toContainText("0.47");
    await expect(rows.nth(0)).toContainText("quarantine expiring");
    await expect(rows.nth(0)).toContainText("8/12");
    await expect(rows.nth(1)).toContainText("SearchTest#findsByName");
    await expect(rows.nth(7)).toContainText("ReportTest#exportsCsv");

    const strip = rows.nth(0).getByRole("list", { name: "Outcome per build, oldest first" });
    await expect(strip.getByRole("listitem")).toHaveCount(24);
  });

  test("lists the quarantine ledger with expiry status, most urgent first", async ({ page }) => {
    await page.goto("/flaky");
    const rows = page.getByTestId("quarantine-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-status", "expired");
    await expect(rows.nth(0)).toContainText("14 days ago");
    await expect(rows.nth(1)).toHaveAttribute("data-status", "expiring");
    await expect(rows.nth(1)).toContainText("in 7 days");
    await expect(
      rows.nth(1).getByRole("link", { name: "github.com/acme/shop/issues/412" }),
    ).toBeVisible();
  });

  test("opens a test's history with the score explanation", async ({ page }) => {
    await page.goto("/flaky");
    await page.getByRole("link", { name: "CheckoutTest#appliesCoupon" }).first().click();
    await expect(page).toHaveURL(/\/flaky\/com\.acme\.shop\.CheckoutTest%23appliesCoupon$/);
    await expect(page.getByTestId("fact-score")).toHaveText("0.47");
    await expect(page.getByTestId("quarantine-entry")).toContainText("Coupon service stub races");

    const components = page.getByTestId("components-table").locator("tbody tr");
    await expect(components).toHaveCount(3);
    await expect(components.nth(0)).toContainText("8 of 12 failures passed on a retry");

    const history = page.getByTestId("history-table").locator("tbody tr");
    await expect(history).toHaveCount(24);
    await expect(history.first()).toContainText("2026-09-10 21:00");
    await expect(history.first()).toContainText("c21");
  });

  test("returns 404 for an unknown test", async ({ page, request }) => {
    const response = await page.goto("/flaky/no.such.Test%23method");
    expect(response?.status()).toBe(404);
    const api = await request.get("/api/flaky/no.such.Test%23method");
    expect(api.status()).toBe(404);
  });

  test("exposes the ranking and a single test through the API", async ({ request }) => {
    const ranking = await request.get("/api/flaky");
    expect(ranking.ok()).toBe(true);
    const body = (await ranking.json()) as {
      tests: { testId: string; score: number; history?: unknown }[];
    };
    expect(body.tests[0]?.testId).toBe("com.acme.shop.CheckoutTest#appliesCoupon");
    expect(body.tests[0]?.history).toBeUndefined();

    const one = await request.get("/api/flaky/com.acme.shop.SearchTest%23findsByName");
    const detail = (await one.json()) as {
      test: { score: number; history: unknown[] };
      quarantine: unknown;
    };
    expect(detail.test.score).toBe(0.411);
    expect(detail.test.history).toHaveLength(24);
    expect(detail.quarantine).toBeNull();
  });
});
