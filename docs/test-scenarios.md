# 0G Time Capsule — User Test Scenarios

End-to-end user scenarios proving the app works as expected. Each scenario:
**precondition → steps → expected result**.

**Coverage** column maps to automated tests:
- 🟢 **unit** — covered by `frontend/lib/__tests__/*` or `test/TimeCapsule.test.ts`
- 🟡 **partial** — logic unit-tested, but full UI/E2E flow still needs manual QA
- 🔴 **manual** — no automated coverage; manual E2E only

> **Playwright E2E added.** Most 🔴 rows now have automated specs in
> `frontend/e2e/` (mock injected wallet → live 0G testnet). Run with `npm run e2e`
> from `frontend/` on **Node 18/20/22** (not Node 23 — see `frontend/e2e/README.md`).
> Automated: 1.1–1.4, 3.6, 4.1/4.2/4.4, 8.1/8.3/8.4, 9.1/9.2, 10.1, 11.1/11.1b,
> 12.2/12.3. Still manual (need funded broadcasts / two wallets): seal→reveal,
> recipient decrypt, dead-man/multisig flows, NFT mint; 2.3 is `test.fixme`.

---

## 1. Wallet & Onboarding

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 1.1 | Connect wallet | `/onboard` → Connect → pick wallet | Address shows, advances to "Add 0G Testnet" (step 2 of the 6-step guide); nav shows connected | 🔴 manual |
| 1.1b | Guided onboarding full run | `/onboard` → connect → add network → faucet → register → seal demo (60s) → reveal | Each step auto-detects done-state and advances; ends on HASH MATCH; resumes after refresh | 🔴 manual |
| 1.2 | Wrong network | Connect on different chain | Prompt to switch to 0G testnet; non-MetaMask wallet does NOT crash (regr. `9bf1008`) | 🔴 manual |
| 1.3 | Disconnect | Connected → Disconnect | Onboard resets to step 1; gated pages prompt connect | 🔴 manual |
| 1.4 | Reconnect persistence | Connect → reload | Session restored, no forced re-connect | 🔴 manual |

## 2. Encryption Key Registration

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 2.1 | Register new key | `/register` → Generate → sign | Keypair generated, privkey in local storage, pubkey on-chain (33 bytes), UI "registered" | 🟡 partial (`KeyRegistry` register/retrieve; `ecies` save/load) |
| 2.2 | Already registered | Revisit `/register` with key on-chain | Shows registered + local key present; no duplicate prompt | 🟡 partial (`hasSavedPrivKey`, overwrite key) |
| 2.3 | On-chain key, no local privkey | Registered, local storage cleared / new device | Warns local key missing → recipient decrypt impossible; offers import | 🔴 manual |
| 2.4 | Export / import privkey | Download → clear → import | Local key restored, recipient decrypt works | 🟡 partial (`ecies` save/load round-trip) |

## 3. Seal a Capsule

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 3.1 | Seal time-lock (happy path) | `/seal` → message → unlock date → Seal → sign | Plaintext encrypted client-side, ciphertext to 0G storage, `commitHash`+`timelockHeader` on-chain, redirect to proof | 🟡 partial (crypto round-trip, `CapsuleSealed` emit) |
| 3.2 | Unlock-time picker | Try presets, unit dropdown, calendar (`266edca`) | All produce valid future `unlockTime`; past date rejected | 🟡 partial (contract reverts past unlockTime) |
| 3.3 | Seal with recipients | Add recipient(s) w/ registered keys | Per-recipient ECIES envelope via `setRecipientKeys()`; recipient w/o key blocked | 🟡 partial (ECIES envelope, `RecipientKeySet`, length-mismatch revert) |
| 3.4 | Seal Dead Man's Switch | DEADMAN trigger + interval → Seal | Redirect `/triggers/deadman/{id}`, deadline set | 🟡 partial (`DeadManSwitch` arm) |
| 3.5 | Seal Multi-Sig | MULTISIG + N signers + threshold M → Seal | Redirect `/triggers/multisig/{id}`, signers+threshold stored | 🟡 partial (`MultiSigReveal`) |
| 3.6 | AI assist | Use AI assistant to draft/improve | Suggestion via `/api/ai-assist` inserted; plaintext stays client-side | 🔴 manual |
| 3.7 | Empty / invalid input | Empty msg, no unlock, bad recipient addr | Validation blocks, clear error, no tx (contract: reverts zero conditions/zero root) | 🟡 partial |
| 3.8 | Large payload / media | Long text or media file | Storage payload framed correctly (`eb93c10`), no truncation | 🟡 partial (1 MB crypto round-trip) |
| 3.9 | Tx rejection | Reject signature in wallet | Graceful error toast, no half-state, retry works | 🔴 manual |

## 4. Proof / Verify Page (public)

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 4.1 | Public proof view | Open `/proof/{id}` unauthenticated | Shows commitHash, unlock time, trigger, state, countdown; no plaintext | 🔴 manual |
| 4.2 | OG / share meta | Share link / inspect `opengraph-image` | OG image + meta render for capsuleId | 🔴 manual |
| 4.3 | Verify commitment | Provide candidate plaintext → verify | `keccak256(plaintext)` vs on-chain commitHash; match=verified, mismatch=tamper warning; animation plays | 🟢 unit (`verify` true/false, `makeCommitHash`) |
| 4.4 | Invalid capsuleId | Open `/proof/0xbad` | Friendly not-found, no crash (regr. `d517948`) | 🔴 manual |

## 5. Reveal — Time Lock

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 5.1 | Reveal before unlock blocked | Owner Reveal before `unlockTime` | Contract rejects / UI disables; countdown shown | 🟢 unit (reverts before unlock) |
| 5.2 | Owner reveal after unlock | After unlock → Reveal & Decrypt → sign `0g-time-capsule-reveal:{id}` | wrapKey derived, dataKey unwrapped, ciphertext fetched, AES decrypts, plaintext shown | 🟡 partial (crypto decrypt round-trip; on-chain reveal emit) |
| 5.3 | Recipient decrypt | Recipient w/ local privkey → Decrypt as recipient | ECIES envelope opened → dataKey → plaintext; non-recipient fails | 🟡 partial (ECIES wrong-key throws; contract blocks non-recipient) |
| 5.4 | Public decrypt | Public-reveal capsule → after unlock anyone decrypts (`eb93c10`) | Plaintext recoverable without owner sig | 🔴 manual |
| 5.5 | Permissionless reveal | Non-owner calls reveal() after condition met | Succeeds, state → revealed | 🟢 unit (reveal after unlock) |
| 5.6 | Double reveal | Reveal an already-revealed capsule | Rejected | 🟢 unit (reverts double-reveal) |
| 5.7 | Tampered ciphertext | Storage blob altered | Decrypt throws (AES-GCM auth tag fail), tamper surfaced | 🟢 unit (tampered ciphertext throws) |

## 6. Dead Man's Switch

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 6.1 | Check-in resets deadline | Owner → Check In | Deadline extended by interval | 🟢 unit (arm+checkin resets) |
| 6.2 | Trigger before deadline blocked | Anyone Trigger before deadline | Rejected | 🟢 unit (reverts while alive) |
| 6.3 | Trigger after missed check-in | Deadline passes → Trigger → Reveal | Switch fires, capsule revealable, decrypt works | 🟢 unit (trigger after interval) |
| 6.4 | Non-owner cannot check in | Non-owner Check In | Rejected | 🔴 manual |

## 7. Multi-Sig Reveal

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 7.1 | Signer approves | Designated signer → Approve | Approval count increments | 🟡 partial |
| 7.2 | Non-signer blocked | Non-listed addr Approve | Rejected | 🟢 unit (non-signer approve reverts) |
| 7.3 | Threshold reached → reveal | M-of-N approve → anyone Reveal | Reveal succeeds, decrypt works | 🟢 unit (`canReveal` after threshold) |
| 7.4 | Below threshold blocked | Reveal with < M approvals | Rejected; hint shows remaining (`d517948`) | 🟢 unit (`canReveal` false until threshold) |
| 7.5 | Double approval | Same signer approves twice | Counted once / reverts | 🟢 unit (double-approve reverts) |

## 8. Gallery

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 8.1 | All tab | `/gallery` | Lists capsules w/ state, countdown, trigger badge | 🔴 manual |
| 8.2 | Mine / Received filters | Connected → switch tabs | Mine=`getOwnerCapsules`, Received=`getRecipientCapsules`, correct role badge | 🟡 partial (contract indexes owner + recipients) |
| 8.3 | Trigger filter | Filter by trigger type | Only matching capsules | 🔴 manual |
| 8.4 | Empty states | New address, no capsules | Friendly empty + create CTA | 🔴 manual |

## 9. Discover

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 9.1 | Tabs soon / revealed / all | `/discover` | Soon=nearest unlock, Revealed=state revealed, All=everything; loads ≤200 events | 🔴 manual |
| 9.2 | Partial load resilience | Some `getCapsule` calls fail | `Promise.allSettled` → page still renders successful rows | 🔴 manual |

## 10. Stats

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 10.1 | Aggregate counts | `/stats` | Total / sealed / revealed / by-trigger / unlocking-soon (24h) / median lock days correct | 🔴 manual |

## 11. NFT

| # | Scenario | Steps | Expected | Coverage |
|---|----------|-------|----------|----------|
| 11.1 | Capsule NFT metadata | GET `/api/nft/{capsuleId}` | Valid metadata JSON | 🔴 manual |
| 11.2 | Marketplace URL | Build NFT marketplace link | URL includes tokenId + contract address | 🟢 unit (`nftMarketplaceUrl`) |

## 12. Cross-cutting / Non-functional

| # | Scenario | Expected | Coverage |
|---|----------|----------|----------|
| 12.1 | Countdown accuracy | Ticks down, flips to "unlocked" at unlockTime | 🔴 manual |
| 12.2 | Mobile / responsive | Nav, seal form, proof usable on small screen | 🔴 manual |
| 12.3 | Loading states | Every route `loading.tsx` shows skeleton, no crash flash | 🔴 manual |
| 12.4 | Storage never sees plaintext | `/api/storage/upload` payload = ciphertext only | 🟡 partial (encryption is client-side) |
| 12.5 | Reload mid-flow | Refresh during seal/reveal doesn't corrupt state | 🔴 manual |
| 12.6 | Two browsers / two wallets | Owner seals, recipient (other browser) decrypts | 🔴 manual |
| 12.7 | Error toasts | RPC/network failure surfaces readable error, not raw stack | 🟡 partial (`storage` download error handling) |

---

## Coverage summary

- **🟢 fully unit-tested logic:** commitment verify, time-lock reveal gating, double-reveal, tamper detection, dead-man-switch lifecycle, multi-sig approvals/threshold, NFT URL.
- **🟡 partial (logic tested, UI/E2E manual):** seal flow, key registration, recipient ECIES, gallery indexing, storage payload.
- **🔴 manual E2E priority:** wallet connect/network/disconnect, proof page render + OG, AI assist, public decrypt, discover/gallery/stats UI, responsive, loading states, full cross-wallet recipient flow.

**Recommended manual E2E focus (highest user-visible risk):** 1.2 (wallet crash regression), 4.4 (proof not-found regression), 5.4 (public decrypt), 12.6 (cross-wallet recipient), 12.4 (no plaintext leak).
