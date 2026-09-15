import { expect, test } from "@playwright/test";

test.describe("LLM evals page", () => {
  test("shows the latest run's summary", async ({ page }) => {
    await page.goto("/evals");
    await expect(page.getByRole("heading", { level: 1, name: "LLM evals" })).toBeVisible();
    await expect(page.getByText("0.85 mean score, pass rate 90%")).toBeVisible();
    await expect(
      page.getByText("support-answer v3 on claude-haiku-4-5-20251001", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("5 runs recorded")).toBeVisible();
    await expect(page.getByTestId("trend-chart")).toBeVisible();
  });

  test("compares prompt and model variants, most recent first", async ({ page }) => {
    await page.goto("/evals");
    const rows = page.getByTestId("variant-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("support-answer v3");
    await expect(rows.nth(0)).toContainText("claude-haiku-4-5-20251001");
    await expect(rows.nth(2)).toContainText("2"); // two runs for v3 on sonnet
  });

  test("flags the drift regression against the baseline", async ({ page }) => {
    await page.goto("/evals");
    await expect(page.getByTestId("drift-verdict")).toHaveText("REGRESSED");
    const rows = page.getByTestId("drift-row");
    await expect(rows).toHaveCount(10);
    const regressed = page.locator('[data-testid="drift-row"][data-regressed="true"]');
    await expect(regressed).toHaveCount(1);
    await expect(regressed).toContainText("shipping-lost-parcel");
  });

  test("breaks scores down by tag, lowest first", async ({ page }) => {
    await page.goto("/evals");
    const rows = page.getByTestId("tag-row");
    await expect(rows.first()).toContainText("escalation");
    await expect(rows.last()).toContainText("safety");
  });

  test("lists every case in the latest run with its checks", async ({ page }) => {
    await page.goto("/evals");
    const rows = page.getByTestId("case-row");
    await expect(rows).toHaveCount(10);
    const failed = page.locator('[data-testid="case-row"][data-passed="false"]');
    await expect(failed).toHaveCount(1);
    await expect(failed).toContainText("shipping-lost-parcel");
  });

  test("exposes the same data through the API", async ({ request }) => {
    const response = await request.get("/api/evals");
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      summary: { latestMeanScore: number };
      drift: { verdict: string };
    };
    expect(body.summary.latestMeanScore).toBe(0.849);
    expect(body.drift.verdict).toBe("REGRESSED");
  });
});
