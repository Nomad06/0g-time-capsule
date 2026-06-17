import { test, expect } from "@playwright/test";

/** Suite 12 — Cross-cutting (responsive + loading), no wallet. */

const ROUTES = ["/", "/discover", "/stats", "/seal", "/gallery"];

test.describe("12.2 Responsive", () => {
  for (const route of ROUTES) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      // Body must not be wider than the viewport (no sideways scroll).
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `horizontal overflow of ${overflow}px on ${route}`).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("12.3 Loading states", () => {
  // Each route eventually shows real content (loading.tsx never sticks).
  for (const route of ROUTES) {
    test(`${route} resolves past loading skeleton`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(route);
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
      expect(errors, errors.join("; ")).toEqual([]);
    });
  }
});
