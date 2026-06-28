# 0G Time Capsule — Product Roadmap

Stage-by-stage improvement plan, mapped to the hackathon tournament. Early stages are **judged**; later stages (Quarter Finals → Final) are decided by **community/public votes**. The throughline: let an average, non-crypto person seal + reveal in under a minute, and make the product genuinely shareable so it collects votes.

**Product decisions**
- **Onboarding:** normie default (email/social embedded wallet, gas sponsored, key auto-derived) with an "advanced — connect my own wallet" opt-in.
- **Social layer:** usernames + profiles, rich share/reveal moments, curated discover, recipient gift links.
- **Hero use case:** Gifts & milestones (birthday / anniversary / wedding / baby-open-at-18).
- **Capacity:** ambitious — full roadmap.

**Status legend:** ✅ done · ⏳ pending

---

## Foundation — Frictionless onboarding ✅

The biggest unlock for average users and for a judge demoing in 60 seconds. Replaces MetaMask + testnet switch + faucet + manual key backup.

- ✅ **Embedded wallet, normie default (advanced opt-in)** — Privy email/Google login + auto-created wallet layered over wagmi; falls back to wallet-only flow when `NEXT_PUBLIC_PRIVY_APP_ID` is unset.
  - `lib/privy-config.ts`, `lib/active-wagmi-config.ts`, `app/providers.tsx`, `components/ConnectButton.tsx`.
  - Forced single `viem` via `package.json` `overrides`; stubbed Privy's optional `@stripe/crypto` + `@farcaster/mini-app-solana` in `next.config.mjs`.
- ✅ **Sponsored gas (no faucet)** — server wallet drips 0.02 A0GI to near-empty users, rate-limited, balance-gated; user still signs (ownership stays correct).
  - `app/api/relay/drip/route.ts`, `lib/relay.ts`, wired centrally into `getWalletClient()`.
- ✅ **Auto key backup (sign-to-derive)** — ECIES key derived deterministically from a wallet signature, so it regenerates on any device; cache-clear no longer locks anyone out. Manual export kept for advanced users.
  - `lib/ecies.ts` (`deriveKeypairFromSignature`), `lib/identity.ts` (`getOrCreateIdentityKey`), wired into register/onboard/reveal paths.

---

## Group Stage → Round of 32 (Judged) — Frictionless & polished ✅

- ✅ **60-second demo path** — onboard collapses to connect → key → seal → reveal for embedded users (network + gas steps dropped); de-jargoned copy.
  - `hooks/useOnboardFlow.ts`, `app/onboard/page.tsx`, landing CTA copy.
- ✅ **Reliability** — gas-drip toast explains the first-write pause; existing loading/empty states across seal/reveal/discover/gallery retained.
- ✅ **Receipt-wait hardening** — `waitForReceipt` dual-polls the wallet's own RPC and the public RPC (whichever returns first), 300s deadline. Fixes "receipt not found" lag on 0G + Privy.
  - `lib/contract.ts`.

---

## Round of 16 (Judged) — Depth, identity & the gift story ✅

- ✅ **Gifts & milestones rebrand** — birthday / anniversary / baby-open-at-18 / graduation templates lead the seal page; copy reframed around gifting.
  - `app/seal/page.tsx`.
- ✅ **Usernames + profiles** — `UsernameRegistry.sol` (written, compiled, **deployed to 0G testnet** at `0x010b5572BfcA105c7dAB7A663981E1D0718d4f62`). `@handle` rendered everywhere; public profile pages.
  - `contracts/UsernameRegistry.sol`, `scripts/deploy-username.ts`, `lib/username.ts`, `components/Address.tsx`, `app/u/[name]/page.tsx`, `app/register/UsernameSection.tsx`.
- ✅ **Recipient gift claim-links (bearer model)** — throwaway keypair doubles as ECIES recipient key + EVM address; secret rides in the link fragment. Recipient opens the link, sees a countdown, decrypts client-side after unlock — **no wallet, no gas, no signup**. Zero contract change.
  - `lib/bearer.ts`, seal-page gift toggle + link panel, `app/claim/[id]/page.tsx`.

---

## Quarter Finals (Community vote, $500 each) — Shareable & votable ⏳

- ⏳ **Rich share + reveal moments** — gift-themed OG share cards, countdown embeds, celebratory reveal-day animation on `proof/[id]`.
  - Build on `app/proof/[id]`, `app/api/nft`, `lib/nft.ts`, `components/CountdownClock.tsx`, `components/HashVerifyAnimation.tsx`.
- ⏳ **Unlock notifications** — "Your capsule from [name] opens today" emails (embedded-wallet email). Needs an email provider key.
  - New `app/api/notify/route.ts` + poll over `lib/events.ts`.
- ⏳ **Curated Discover** — "Opening soon" + "Featured" rails and reactions, replacing the raw list.
  - `app/discover/page.tsx`, `lib/events.ts`, `components/CapsuleCard.tsx`.
- ⏳ **Vote CTA** — dismissible banner during the voting window.
  - `components/Nav.tsx`.

---

## Semi Finals (Public vote, $1,000 each) — Virality loops & mobile ⏳

- ⏳ **Mobile / PWA** — installable PWA, native share sheet on `proof/[id]`, responsive pass on seal/discover.
- ⏳ **Gifting referral loop** — bearer gift links already recruit openers; add a subtle "Sealed with 0G Time Capsule" share footer.
- ⏳ **Themed collections** — public collections (e.g. "New Year 2027 capsules") from `lib/events.ts` filters.

---

## Final (Community crowns champion, $2,000 each) — Emotional peak ⏳

- ⏳ **Public reveal events** — scheduled mass-reveal moments + live countdown on the home page.
- ⏳ **Revealed highlights gallery** — best revealed (public) capsules + testimonials.
- ⏳ **Final polish** — performance, accessibility, copy, load-time pass.

---

## Operational notes

- **Env:** `NEXT_PUBLIC_PRIVY_APP_ID` enables the normie flow (set). `STORAGE_PRIVATE_KEY` wallet now pays **both** 0G storage fees and gas drips — keep it funded with testnet A0GI. `NEXT_PUBLIC_USERNAME_REGISTRY_ADDRESS` points at the deployed registry.
- **Deploy a contract without disturbing existing addresses:** standalone scripts (e.g. `npm run deploy:username`) append to `deployments/zerogTestnet.json`.
- **Verification:** `npm run typecheck`, `npm test` (34 tests), `npm run build` all green as of the last foundation/R16 work.

### Smoke-test the normie flow
1. Fresh browser/incognito → Sign in (email/Google) → embedded wallet auto-created.
2. `/register` → Sign & Register (gas auto-drips — fund the storage wallet first).
3. `/seal` → write or pick a gift template → optionally toggle "create a gift link" → seal.
4. Open the gift link in another browser → wait out the countdown → open, decrypt, verify. No wallet needed.
5. Clear localStorage → reveal again → "Restore key" re-derives the same key.
