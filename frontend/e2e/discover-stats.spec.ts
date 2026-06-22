import { test, expect } from "@playwright/test";

/** Suites 9 + 10 — Discover & Stats (read-only, no wallet). */

test.describe("9. Discover", () => {
  // 9.1 Tabs soon / revealed / all
  test("9.1 tabs switch and render rows or empty state", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/discover");

    for (const tab of ["Unlocking Soon", "Revealed", "All"]) {
      await page.getByRole("button", { name: tab }).click();
      // Each tab settles into either capsule links or the empty message.
      await expect
        .poll(
          async () =>
            (await page.locator('a[href^="/proof/0x"]').count()) > 0 ||
            (await page.getByText("No capsules here yet.").isVisible().catch(() => false)),
          { timeout: 20_000 },
        )
        .toBe(true);
    }
    expect(errors, errors.join("; ")).toEqual([]);
  });

  // 9.2 Partial load resilience — page renders even if some reads fail.
  test("9.2 discover renders despite flaky reads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/discover");
    // Heading present regardless of how many getCapsule calls resolved.
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    expect(errors, errors.join("; ")).toEqual([]);
  });
});

test.describe("10. Stats", () => {
  // 10.1 Aggregate counts render
  test("10.1 protocol stats render aggregate cards", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Protocol Stats" })).toBeVisible();
    await expect(page.getByText("Total Sealed")).toBeVisible();
    await expect(page.getByText("Unlocking in 24h")).toBeVisible();
    await expect(page.getByText("Median lock")).toBeVisible();
    // "Revealed" appears both as a stat card and a trigger label — just assert presence.
    await expect(page.getByText("Revealed").first()).toBeVisible();
  });
});
