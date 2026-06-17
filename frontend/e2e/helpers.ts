import { type Page, expect } from "@playwright/test";

/**
 * Find a real capsule id from the live /discover feed so read-only proof/NFT
 * tests run against on-chain data. Returns null if the feed is empty.
 */
export async function firstCapsuleId(page: Page): Promise<`0x${string}` | null> {
  await page.goto("/discover");
  await page.getByRole("button", { name: "All" }).click();
  // Either capsule links appear, or the empty state renders.
  const link = page.locator('a[href^="/proof/0x"]').first();
  const empty = page.getByText("No capsules here yet.");
  await Promise.race([
    link.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
    empty.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
  ]);
  if (await empty.isVisible().catch(() => false)) return null;
  const href = await link.getAttribute("href").catch(() => null);
  const id = href?.replace("/proof/", "");
  return id && /^0x[0-9a-fA-F]{64}$/.test(id) ? (id as `0x${string}`) : null;
}

/** A syntactically valid capsuleId that (almost certainly) does not exist. */
export const NONEXISTENT_ID =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000000" as const;
