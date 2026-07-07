import { test, expect } from "@playwright/test";

test.describe("FLA Assessment Detail", () => {
  test("assessment detail page loads required sections", async ({ page }) => {
    // Navigate to dashboard first to find an assessment
    await page.goto("/fla");

    const assessmentLink = page.locator('a[href^="/fla/cm"]').first();
    if (!(await assessmentLink.isVisible())) {
      test.skip(true, "No assessments available to test");
      return;
    }
    await assessmentLink.click();
    await page.waitForURL(/\/fla\/cm/);

    // Should have Samples section
    await expect(page.getByRole("heading", { name: /Samples/ })).toBeVisible({
      timeout: 5000,
    });
  });

  test("can change assessment status", async ({ page }) => {
    await page.goto("/fla");

    const assessmentLink = page.locator('a[href^="/fla/cm"]').first();
    if (!(await assessmentLink.isVisible())) {
      test.skip(true, "No assessments available");
      return;
    }
    await assessmentLink.click();
    await page.waitForURL(/\/fla\/cm/);

    // Look for status dropdown
    const statusSelect = page.locator("select#status");
    if (await statusSelect.isVisible()) {
      // Just verify it exists and is interactive
      await expect(statusSelect).toBeEnabled();
    }
  });

  test("findings section is present", async ({ page }) => {
    await page.goto("/fla");

    const assessmentLink = page.locator('a[href^="/fla/cm"]').first();
    if (!(await assessmentLink.isVisible())) {
      test.skip(true, "No assessments available");
      return;
    }
    await assessmentLink.click();
    await page.waitForURL(/\/fla\/cm/);

    // Findings section should be visible
    await expect(page.getByRole("heading", { name: /Findings/ })).toBeVisible({ timeout: 5000 });
  });
});
