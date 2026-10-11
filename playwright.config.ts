import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4318",
    headless: true,
    launchOptions: process.env.OFFICE_BROWSER_PATH
      ? { executablePath: process.env.OFFICE_BROWSER_PATH }
      : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "apps/desktop/resources/bin/office-server -listen 127.0.0.1:4318 -data .office-data/e2e -web apps/web/dist",
    url: "http://127.0.0.1:4318/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
