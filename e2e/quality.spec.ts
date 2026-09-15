import { expect, test } from "@playwright/test";

test.describe("test quality page", () => {
  test("shows the summary, trend and rule table for the latest run", async ({ page }) => {
    await page.goto("/quality");
    await expect(page.getByRole("heading", { level: 1, name: "Test quality" })).toBeVisible();
    await expect(page.getByText("4 findings in the latest run")).toBeVisible();
    await expect(page.getByText("0 error, 3 warn, 1 info")).toBeVisible();
    await expect(page.getByTestId("trend-chart")).toBeVisible();

    const rows = page.getByTestId("rule-row");
    await expect(rows).toHaveCount(7);
    await expect(rows.first()).toContainText("TQL003");
    await expect(rows.first()).toContainText("NoAssertion");
    await expect(rows.first()).toContainText("WARN");
  });

  test("lists the worst files from the latest run", async ({ page }) => {
    await page.goto("/quality");
    const rows = page.getByTestId("worst-file-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("CartTest.java");
  });

  test("lists the latest findings with fix hints", async ({ page }) => {
    await page.goto("/quality");
    const items = page.getByTestId("findings-list").locator("li");
    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText("TQL003");
    await expect(items.first()).toContainText("Fix: Assert on the merged item list");
  });

  test("exposes the same data through the API", async ({ request }) => {
    const response = await request.get("/api/quality");
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      summary: { latestFindings: number };
      rules: unknown[];
    };
    expect(body.summary.latestFindings).toBe(4);
    expect(body.rules).toHaveLength(7);
  });
});
