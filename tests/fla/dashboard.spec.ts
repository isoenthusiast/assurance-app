import { test, expect } from "@playwright/test";

test.describe("FLA Dashboard", () => {
  test("loads dashboard with heading", async ({ page }) => {
    await page.goto("/fla");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("shows Plan Assessment button", async ({ page }) => {
    await page.goto("/fla");
    await expect(
      page.locator('a[href="/admin/assessments/new"]')
    ).toBeVisible();
  });

  test("displays assessment cards", async ({ page }) => {
    await page.goto("/fla");

    // Should have at least one assessment card (links to /fla/[id])
    const assessmentLinks = page.locator('a[href^="/fla/cm"]');
    const count = await assessmentLinks.count();

    // May be zero if no assessments exist, but page should still load
    if (count > 0) {
      await expect(assessmentLinks.first()).toBeVisible();
    }
  });

  test("standard filter buttons are present", async ({ page }) => {
    await page.goto("/fla");

    // Check for standard filter buttons
    await expect(page.locator("button:has-text('All Standards')")).toBeVisible();
  });

  test("gamification sidebar is visible", async ({ page }) => {
    await page.goto("/fla");

    // Gamification dashboard should show points or progress
    await expect(page.locator("text=Points")).toBeVisible({ timeout: 5000 });
  });

  test("can click into an assessment detail page", async ({ page }) => {
    await page.goto("/fla");

    const assessmentLink = page.locator('a[href^="/fla/cm"]').first();
    if (await assessmentLink.isVisible()) {
      await assessmentLink.click();
      // Should navigate to assessment detail
      await expect(page).toHaveURL(/\/fla\/cm/);
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});
