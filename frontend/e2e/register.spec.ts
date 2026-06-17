import { test, expect, connect } from "./fixtures/mock-wallet";

/** Suite 2 — Encryption key registration (🔴 row 2.3). */

test.describe("2. Key registration", () => {
  // Sanity: the register page renders and gates on connection.
  test("register page renders for a connected wallet", async ({ page }) => {
    await page.goto("/register");
    await connect(page);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  /**
   * 2.3 On-chain key present but no local privkey → warn the user that
   * recipient decryption is impossible until they re-import.
   *
   * Needs a pre-funded account already registered on-chain (so hasEncryptionKey
   * returns true) while localStorage holds no privkey. Provide such a key via
   * E2E_REGISTERED_PRIVKEY to enable this test.
   */
  test.fixme(
    "2.3 on-chain key without local privkey shows re-import warning",
    async ({ page }) => {
      // Requires E2E_REGISTERED_PRIVKEY (registered + funded). Then:
      //   - installMockWallet with that key
      //   - clear localStorage privkey entry
      //   - goto /register and assert the "local key missing / import" warning
      expect(process.env.E2E_REGISTERED_PRIVKEY).toBeTruthy();
    },
  );
});
