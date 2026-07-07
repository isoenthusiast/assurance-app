import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard", () => {
  test("loads admin dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText(/admin/i, { timeout: 10000 });
  });

  test("shows data table cards", async ({ page }) => {
    await page.goto("/admin");

    // Admin dashboard should have grid of management cards with headings
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Database" })).toBeVisible({ timeout: 5000 });
  });

  test("has link to assessments management", async ({ page }) => {
    await page.goto("/admin");
    await page.click("text=Assessments");
    await expect(page).toHaveURL(/\/admin\/assessments/);
  });

  test("admin assessments page loads with table", async ({ page }) => {
    await page.goto("/admin/assessments");
    await expect(page.locator("table")).toBeVisible({ timeout: 5000 });
  });

  test("new assessment page loads", async ({ page }) => {
    await page.goto("/admin/assessments/new");
    // Should have the Plan Assessment heading (page loads dynamically)
    await expect(page.getByRole("heading", { name: /Plan Assessment/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Admin Data Management", () => {
  test("database management page loads", async ({ page }) => {
    await page.goto("/admin/database-management");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
  });

  test("export data page loads", async ({ page }) => {
    await page.goto("/admin/export-data");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
  });

  test("import CSV page loads", async ({ page }) => {
    await page.goto("/admin/import-csv");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
  });
});
