import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** End-to-end tests run against the built application serving the fixture repository. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --port ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}/api/overview`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Two repos, both pointing at the same fixture data, so the switcher itself is
      // exercised end to end without a second fixture set to maintain. "acme-shop" is first
      // so it stays the default repo every other spec file assumes.
      TOOLKIT_REPOS: "acme-shop=fixtures/acme-shop,acme-shop-mirror=fixtures/acme-shop",
      TOOLKIT_NOW: "2026-09-13T12:00:00Z",
    },
  },
});
