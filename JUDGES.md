# 0G Time Capsule — Judge Quickstart

Seal an encrypted message, lock it on-chain until a chosen time, then decrypt and
**prove** it matches an on-chain commitment. Capsules are private — only the owner
and named recipients can ever decrypt, and not before unlock.

**Fastest path: open `/onboard` in the app.** It walks all six steps below with
live state detection. This doc is the written mirror (and offline reference).

---

## Prerequisites

- A Chromium browser with **MetaMask** (or any injected EVM wallet).
- ~3 minutes for the faucet + a 60-second capsule unlock.

### Add the 0G Testnet network

`/onboard` adds it for you (step 2). To add manually:

| Field | Value |
|-------|-------|
| Network name | `0G Testnet` |
| Chain ID | `16602` |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Currency symbol | `A0GI` |
| Decimals | `18` |
| Block explorer | `https://chainscan-galileo.0g.ai` |

### Get test gas

Faucet: **https://faucet.0g.ai/**

- Sign in with X (Twitter), paste your address, solve the captcha.
- Limit ~0.1 per wallet per day — one request is plenty for the demo.
- Gas is only needed for transactions (register key, seal, reveal, mint).

---

## The 6-step flow (mirrors `/onboard`)

1. **Connect wallet** — top-right Connect button.
2. **Add 0G Testnet** — approve the add/switch prompt (chain 16602).
3. **Get test gas** — faucet above; the page detects your balance.
4. **Register encryption key** — generates a secp256k1 keypair: private key stays
   in your browser's localStorage, public key goes on-chain.
   **Required** — capsules are undecryptable without it.
5. **Seal a demo capsule** — encrypts a sample message, locked for **60 seconds**,
   with you as the sole recipient (one wallet does everything).
   - *Optional:* mint the capsule as an NFT — **only works before it unlocks.**
6. **Reveal & prove** — wait out the countdown, then decrypt. You'll see the
   plaintext and a **HASH MATCH** confirming it equals the on-chain `keccak256`
   commitment made at seal time.

### Try it yourself after the demo

`/seal` → write a message, pick an unlock time, optionally add recipient
addresses (each recipient must have registered a key at `/register` first).
`/gallery` lists capsules you own or received. `/proof/{id}` is the shareable
proof + reveal page.

---

## What to look for (the differentiators)

- **Client-side encryption** — plaintext never leaves the browser unencrypted;
  ciphertext lives on 0G Storage, only the commitment + envelopes on-chain.
- **Time-lock via drand** — the key is mathematically underivable before the
  unlock round publishes. Not even the owner can read early.
- **Private recipients** — decryption needs *both* a recipient's key *and* the
  unlock time. A non-recipient wallet cannot decrypt, ever.
- **Proof-of-existence** — `keccak256(plaintext)` committed at seal proves the
  exact content existed before the unlock date.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Wrong network" / tx won't send | Switch wallet to 0G Testnet (chain 16602). Step 2 does this. |
| "Register an encryption key first" on seal | You skipped step 4. Visit `/register` or onboard step 4. |
| Decrypt says no key on this device | The private key is per-browser. Use the same browser you registered in, or import it at `/register`. |
| Mint fails: "already revealed" | NFTs must be minted **while SEALED**, before unlock. |
| Seal/reveal fails with insufficient funds | Empty balance — hit the faucet (step 3). |
| Receipt "could not be found" after a tx | 0G's public RPC is load-balanced and can lag; the app retries automatically. If it surfaces, just retry the action. |
| Faucet rejects you | Daily limit hit or X-login required — wait or use a different X account. |

---

For the full QA scenario matrix and automated test coverage, see
[`docs/test-scenarios.md`](docs/test-scenarios.md).
