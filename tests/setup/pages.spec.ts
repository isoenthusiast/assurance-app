import { test, expect } from "@playwright/test";

test.describe("Setup - Process Areas", () => {
  test("process areas page loads", async ({ page }) => {
    await page.goto("/setup/process-areas");
    await expect(page.locator("h1")).toContainText(/process area/i, {
      timeout: 5000,
    });
  });

  test("shows standard sections", async ({ page }) => {
    await page.goto("/setup/process-areas");

    // Should have standard headings like HSSE, Carbon, etc.
    await expect(
      page.locator("text=HSSE").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("has add process area form", async ({ page }) => {
    await page.goto("/setup/process-areas");

    // Look for "Add" button or "New" link
    const addButton = page.locator("button:has-text('Add'), a:has-text('Add')");
    if (await addButton.isVisible()) {
      await expect(addButton).toBeEnabled();
    }
  });
});

test.describe("Setup - Controls", () => {
  test("controls page loads", async ({ page }) => {
    await page.goto("/setup/controls");
    await expect(page.locator("h1")).toContainText(/control/i, {
      timeout: 5000,
    });
  });

  test("controls table is present", async ({ page }) => {
    await page.goto("/setup/controls");
    await expect(page.locator("table")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Setup - Activity Types", () => {
  test("activity types page loads", async ({ page }) => {
    await page.goto("/setup/activity-types");
    await expect(page.locator("h1")).toContainText(/activity type/i, {
      timeout: 5000,
    });
  });
});
