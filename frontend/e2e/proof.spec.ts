import { test, expect } from "@playwright/test";
import { firstCapsuleId, NONEXISTENT_ID } from "./helpers";

/** Suite 4 — Proof / Verify Page (public, no wallet). */

test.describe("4. Proof page", () => {
  // 4.1 Public proof view — commitment visible without a wallet
  test("4.1 public proof view shows on-chain commitment", async ({ page }) => {
    const id = await firstCapsuleId(page);
    test.skip(!id, "no capsules on the live feed to inspect");

    await page.goto(`/proof/${id}`);
    await expect(page.getByRole("heading", { name: "Time Capsule" })).toBeVisible();
    await expect(page.getByText("On-chain commitment")).toBeVisible();
    await expect(page.getByText("Commit hash", { exact: true })).toBeVisible();
    // No plaintext leaks pre-reveal: the decrypt result block is absent.
    await expect(page.getByText(/Decrypted/i)).toHaveCount(0);
  });

  // 4.4 Invalid capsuleId — graceful, no crash (regression d517948)
  test("4.4 nonexistent capsule renders without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`/proof/${NONEXISTENT_ID}`);

    // Header still renders; the commitment block is simply absent.
    await expect(page.getByRole("heading", { name: "Time Capsule" })).toBeVisible();
    await expect(page.getByText("On-chain commitment")).toHaveCount(0);
    expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
  });

  // 4.2 OG / share meta render for a capsule
  test("4.2 OG meta tags present for a capsule", async ({ page, request }) => {
    const id = await firstCapsuleId(page);
    test.skip(!id, "no capsules on the live feed to inspect");

    const res = await request.get(`/proof/${id}`);
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toMatch(/<meta property="og:title"/i);
    expect(html).toMatch(/<meta property="og:image"/i);
    expect(html).toMatch(new RegExp(`/proof/${id}/opengraph-image`));
  });
});
