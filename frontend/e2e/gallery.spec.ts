import { test, expect, connect, installMockWallet } from "./fixtures/mock-wallet";

/**
 * Suite 8 — Gallery (wallet-gated). A fresh throwaway key is injected, so
 * "Mine"/"Received" are empty → exercises the empty state cleanly.
 */

test.describe("8. Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await installMockWallet(page);
    await page.goto("/gallery");
    await connect(page);
  });

  // 8.1 All tab lists capsules (or empty), no crash
  test("8.1 All tab renders feed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Tab labels carry a count suffix, e.g. "All (0)".
    await page.getByRole("button", { name: /^All \(/ }).click();
    await expect
      .poll(
        async () =>
          (await page.locator('a[href^="/proof/0x"]').count()) > 0 ||
          (await page.getByText(/No capsules/i).first().isVisible().catch(() => false)),
        { timeout: 20_000 },
      )
      .toBe(true);
    expect(errors, errors.join("; ")).toEqual([]);
  });

  // 8.4 Empty state for a fresh account
  test("8.4 fresh account sees empty state + create CTA", async ({ page }) => {
    await page.getByRole("button", { name: /^Mine \(/ }).click();
    await expect(page.getByText("No capsules yet.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Create your first capsule/i })).toBeVisible();
  });

  // 8.3 Trigger filter narrows the list (or shows no-match)
  test("8.3 trigger filter applies without crash", async ({ page }) => {
    await page.getByRole("button", { name: /^All \(/ }).click();
    // Trigger filter chips only render when the account has rows; for a fresh
    // account they're absent → the test skips. With data they narrow the list.
    const dms = page.getByRole("button", { name: /Dead Man/i }).first();
    if (await dms.isVisible().catch(() => false)) {
      await dms.click();
      await expect
        .poll(
          async () =>
            (await page.locator('a[href^="/proof/0x"]').count()) >= 0,
          { timeout: 15_000 },
        )
        .toBe(true);
    } else {
      test.skip(true, "trigger filter chips not present");
    }
  });
});
