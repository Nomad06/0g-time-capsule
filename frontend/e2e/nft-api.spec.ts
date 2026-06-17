import { test, expect } from "@playwright/test";
import { firstCapsuleId, NONEXISTENT_ID } from "./helpers";

/** Suite 11 — NFT metadata API. */

test.describe("11. NFT metadata API", () => {
  // 11.1 Valid metadata JSON for an existing capsule
  test("11.1 returns ERC-721 metadata for a real capsule", async ({ page, request }) => {
    const id = await firstCapsuleId(page);
    test.skip(!id, "no capsules on the live feed to inspect");

    const res = await request.get(`/api/nft/${id}`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toMatchObject({
      name: expect.any(String),
      description: expect.any(String),
      image: expect.any(String),
      external_url: expect.stringContaining(`/proof/${id}`),
    });
    expect(Array.isArray(json.attributes)).toBe(true);
    expect(json.attributes.map((a: any) => a.trait_type)).toEqual(
      expect.arrayContaining(["Trigger", "State", "Unlock", "Owner"]),
    );
  });

  // Nonexistent capsule: the contract's getCapsule returns a zeroed struct
  // (no revert), so the route responds 200 with a zero-address owner rather
  // than 404. Either is acceptable as "graceful"; assert no server error.
  test("11.1b handles nonexistent capsule gracefully", async ({ request }) => {
    const res = await request.get(`/api/nft/${NONEXISTENT_ID}`);
    expect(res.status(), "must not 5xx").toBeLessThan(500);
    if (res.status() === 200) {
      const json = await res.json();
      const owner = json.attributes?.find((a: any) => a.trait_type === "Owner")?.value;
      expect(owner, "empty capsule → zero owner").toMatch(/^0x0{40}$/);
    } else {
      expect(res.status()).toBe(404);
    }
  });
});
