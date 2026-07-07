import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/admin.json");
const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "PaaP6ggFHqsr";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Fill in credentials
  await page.fill('input[name="username"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Should redirect to dashboard
  await expect(page).toHaveURL("/fla", { timeout: 10000 });

  // Verify we see the dashboard
  await expect(page.locator("h1")).toContainText("Dashboard");

  // Save storage state for authenticated tests
  await page.context().storageState({ path: AUTH_FILE });
});
