import { expect, test } from "@playwright/test";

test.describe("repository switcher", () => {
  test("lists the configured repos and marks the default active", async ({ page }) => {
    await page.goto("/");
    const switcher = page.getByTestId("repo-switcher");
    await expect(switcher).toBeVisible();
    const options = switcher.getByTestId("repo-option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("acme-shop");
    await expect(options.nth(0)).toHaveAttribute("aria-current", "page");
    await expect(options.nth(1)).toHaveText("acme-shop-mirror");
  });

  test("switching repos updates the URL and keeps showing the same fixture data", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("repo-switcher").getByRole("link", { name: "acme-shop-mirror" }).click();
    await expect(page).toHaveURL(/\?repo=acme-shop-mirror$/);
    await expect(page.getByRole("strong").getByText("acme-shop-mirror")).toBeVisible();
    await expect(page.getByTestId("tile-flaky-value")).toHaveText("2");
  });

  test("the choice carries across navigation to another page", async ({ page }) => {
    await page.goto("/?repo=acme-shop-mirror");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Flaky tests" })
      .click();
    await expect(page).toHaveURL(/\/flaky\?repo=acme-shop-mirror$/);
    await expect(page.getByText("2 flaky of 8 tests")).toBeVisible();
  });

  test("switching back to the default repo drops the query param", async ({ page }) => {
    await page.goto("/?repo=acme-shop-mirror");
    await page
      .getByTestId("repo-switcher")
      .getByRole("link", { name: "acme-shop", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the API accepts a repo query param", async ({ request }) => {
    const response = await request.get("/api/overview?repo=acme-shop-mirror");
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { flake: { flakyTests: number } };
    expect(body.flake.flakyTests).toBe(2);
  });
});
