import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
  ],

  timeout: 30000,
  expect: { timeout: 10000 },

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Auth setup — logs in as admin and saves storage state
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Authenticated tests (admin)
    {
      name: "authenticated",
      testMatch: /\.spec\.ts/,
      testIgnore: /login\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/admin.json",
      },
    },

    // Unauthenticated tests
    {
      name: "unauthenticated",
      testMatch: /login\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
