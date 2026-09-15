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
      TOOLKIT_DATA_DIR: "fixtures/acme-shop",
      TOOLKIT_NOW: "2026-09-13T12:00:00Z",
    },
  },
});
