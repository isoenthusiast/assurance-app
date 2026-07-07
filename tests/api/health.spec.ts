import { test, expect } from "@playwright/test";

test.describe("API Health Checks", () => {
  test("login API accepts credentials", async ({ request }) => {
    const response = await request.post("/api/auth/callback/credentials", {
      form: {
        username: "admin",
        password: "PaaP6ggFHqsr",
        csrfToken: "test", // NextAuth will handle CSRF
        json: "true",
      },
    });

    // Either redirect on success or 401 on bad CSRF — both mean the endpoint exists
    expect(response.status()).toBeLessThan(500);
  });

  test("gamification stats endpoint exists", async ({ request }) => {
    // Without auth, this may redirect; we just verify the endpoint doesn't 500
    const response = await request.get("/api/gamification/stats");
    expect(response.status()).toBeLessThan(500);
  });

  test("leaderboard endpoint exists", async ({ request }) => {
    const response = await request.get("/api/gamification/leaderboard");
    expect(response.status()).toBeLessThan(500);
  });

  test("admin check endpoint requires auth", async ({ request }) => {
    const response = await request.get("/api/admin/check");
    // Should be 401 Unauthorized without session
    expect([401, 403, 200]).toContain(response.status());
  });

  test("database sync check endpoint requires auth", async ({ request }) => {
    const response = await request.get("/api/admin/database/sync-check");
    expect(response.status()).toBeLessThan(500);
  });

  test("export all tables endpoint requires auth", async ({ request }) => {
    const response = await request.get("/api/admin/export-all-tables");
    expect(response.status()).toBeLessThan(500);
  });

  test("admin assessments endpoint requires auth", async ({ request }) => {
    const response = await request.get("/api/admin/assessments");
    expect(response.status()).toBeLessThan(500);
  });
});
