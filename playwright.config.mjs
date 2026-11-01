import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://localhost:3100",
    // Optional: test with an installed Chromium browser instead of Playwright's.
    launchOptions: { executablePath: process.env.E2E_BROWSER_PATH || undefined },
  },
  webServer: {
    command: "npx next build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
