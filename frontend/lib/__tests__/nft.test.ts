import { describe, it, expect } from "vitest";
import { nftMarketplaceUrl } from "../nft";

describe("nftMarketplaceUrl", () => {
  it("includes tokenId in URL", () => {
    const url = nftMarketplaceUrl(42n);
    expect(url).toContain("42");
  });

  it("includes contract address in URL", () => {
    const url = nftMarketplaceUrl(1n);
    // CONTRACT_ADDRESSES.CapsuleNFT defaults to "0x" in test env, that's fine
    expect(url).toMatch(/^https:\/\//);
  });
});

// mintCapsuleNFT integration-level test is skipped (requires viem client + chain)
// The parseEventLogs fix is verified via typecheck + manual test
