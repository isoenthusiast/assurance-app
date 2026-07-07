import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");

    // Page title
    await expect(page.locator("h1")).toContainText(/sign in/i);

    // Form fields
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="username"]', "wronguser");
    await page.fill('input[name="password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // Should stay on login page with error
    await expect(page).toHaveURL("/login");
    await expect(page.locator("text=Invalid")).toBeVisible({ timeout: 5000 });
  });

  test("redirects to login when accessing protected page unauthenticated", async ({ page }) => {
    await page.goto("/admin");

    // Should be redirected to login or see sign-in prompt
    await expect(page.locator("text=Sign in")).toBeVisible({ timeout: 5000 });
  });
});
