import { expect, test } from "@playwright/test";

test.describe("overview page", () => {
  test("shows the three tiles with headline numbers and sparklines", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

    const flaky = page.getByTestId("tile-flaky");
    await expect(flaky.getByTestId("tile-flaky-value")).toHaveText("2");
    await expect(flaky).toContainText("of 8 tests across 24 builds");
    await expect(flaky.getByRole("img", { name: /flaky test executions per week/i })).toBeVisible();

    const quality = page.getByTestId("tile-quality");
    await expect(quality.getByTestId("tile-quality-value")).toHaveText("4");
    await expect(quality).toContainText("-1 vs the previous run");

    const evals = page.getByTestId("tile-evals");
    await expect(evals.getByTestId("tile-evals-value")).toHaveText("0.85");
    await expect(evals).toContainText("pass rate 90%");
  });

  test("warns about expired and expiring quarantine entries", async ({ page }) => {
    await page.goto("/");
    const warnings = page.getByTestId("quarantine-warnings");
    await expect(warnings).toContainText(
      "InventoryTest#reservesStock expired on 2026-08-30 (14 days ago)",
    );
    await expect(warnings).toContainText(
      "CheckoutTest#appliesCoupon expires on 2026-09-20 (in 7 days)",
    );
  });

  test("links each tile to its page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tile-flaky").getByRole("link", { name: "Flaky tests" }).click();
    await expect(page).toHaveURL(/\/flaky$/);
    await expect(page.getByRole("heading", { level: 1, name: "Flaky tests" })).toBeVisible();
  });

  test("serves the same numbers as JSON", async ({ request }) => {
    const response = await request.get("/api/overview");
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      flake: { flakyTests: number; trend: unknown[] };
      lint: { latestFindings: number };
      evals: { latestMeanScore: number };
    };
    expect(body.flake.flakyTests).toBe(2);
    expect(body.flake.trend).toHaveLength(8);
    expect(body.lint.latestFindings).toBe(4);
    expect(body.evals.latestMeanScore).toBe(0.849);
  });
});
