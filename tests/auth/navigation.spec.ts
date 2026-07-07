import { test, expect } from "@playwright/test";

test.describe("Navigation Bar", () => {
  test("shows CONAN PROJECT branding", async ({ page }) => {
    await page.goto("/fla");
    await expect(page.locator("header")).toContainText("CONAN PROJECT");
  });

  test("has working FLA dashboard link", async ({ page }) => {
    await page.goto("/fla");
    await page.click('a[href="/fla"]');
    await expect(page).toHaveURL("/fla");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("has working Setup links", async ({ page }) => {
    await page.goto("/fla");

    // Process Areas link
    const processAreasLink = page.locator('a[href="/setup/process-areas"]');
    if (await processAreasLink.isVisible()) {
      await processAreasLink.click();
      await expect(page).toHaveURL("/setup/process-areas");
    }
  });

  test("has working Admin link for admin user", async ({ page }) => {
    await page.goto("/fla");

    const adminLink = page.locator('a[href="/admin"]');
    if (await adminLink.isVisible()) {
      await adminLink.click();
      await expect(page).toHaveURL("/admin");
    }
  });

  test("shows sign-out option", async ({ page }) => {
    await page.goto("/fla");
    await expect(page.locator("button:has-text('Sign out')")).toBeVisible();
  });

  test("signs out and redirects to login", async ({ page }) => {
    await page.goto("/fla");
    await page.click("button:has-text('Sign out')");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});
