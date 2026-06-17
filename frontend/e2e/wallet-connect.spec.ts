import { test, expect, installMockWallet, connect } from "./fixtures/mock-wallet";

/**
 * Suite 1 — Wallet & Onboarding (🔴 rows from docs/test-scenarios.md)
 * Uses the mock injected wallet; no MetaMask extension.
 */

test.describe("1. Wallet & Onboarding", () => {
  // 1.1 Connect wallet
  test("1.1 connect wallet shows address + advances onboarding", async ({ page, wallet }) => {
    await page.goto("/onboard");
    await connect(page);

    // Address (truncated) should surface somewhere in the page after connect.
    const short = `${wallet.address.slice(0, 6)}`.toLowerCase();
    await expect
      .poll(async () => (await page.content()).toLowerCase().includes(short), {
        timeout: 15_000,
      })
      .toBe(true);

    // Connected state proven by the Disconnect control replacing Connect.
    await expect(page.getByRole("button", { name: /disconnect/i }).first()).toBeVisible();
  });

  // 1.3 Disconnect resets gated state
  test("1.3 disconnect resets onboarding to connect step", async ({ page, wallet }) => {
    await page.goto("/onboard");
    await connect(page);
    await expect(page.getByRole("button", { name: /disconnect/i }).first()).toBeVisible();

    // Simulate wallet-side disconnect.
    await wallet.emit("accountsChanged", []);
    await wallet.emit("disconnect");

    await expect(
      page.getByRole("button", { name: /^connect/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // 1.4 Reconnect persistence — session restored after reload
  test("1.4 wallet session persists across reload", async ({ page, wallet }) => {
    await page.goto("/onboard");
    await connect(page);
    const short = wallet.address.slice(0, 6).toLowerCase();
    await expect
      .poll(async () => (await page.content()).toLowerCase().includes(short), { timeout: 15_000 })
      .toBe(true);

    await page.reload();

    // Should NOT be forced back to a bare "Connect" with no address.
    await expect
      .poll(async () => (await page.content()).toLowerCase().includes(short), { timeout: 15_000 })
      .toBe(true);
  });

  // 1.2 Wrong network + non-MetaMask must not crash (regression 9bf1008)
  test("1.2 non-MetaMask wallet on wrong network does not crash", async ({ page }) => {
    // Fresh page: install a non-MetaMask wallet reporting a wrong chainId.
    await installMockWallet(page, { isMetaMask: false, chainId: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/onboard");
    await connect(page);

    // App stays alive — heading still rendered, no uncaught page error.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
