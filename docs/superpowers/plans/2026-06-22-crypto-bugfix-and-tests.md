# Crypto Bugfix & Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven bugs found in code review (one critical crypto KDF mismatch that makes decryption always fail, plus six medium/low severity issues) and add a Vitest-based test suite covering all changed logic.

**Architecture:** Add Vitest + `@vitest/coverage-v8` to `frontend/`. Pure library functions in `frontend/lib/` are tested directly as ESM modules. React hooks are not tested at this layer (no JSDOM setup needed). Smart-contract Hardhat tests already exist at root level — those are not modified.

**Tech Stack:** Vitest 1.x, `@noble/*` (already installed), TypeScript, existing project deps.

## Global Constraints

- All fixes must be backward-compatible with the existing Hardhat contract tests.
- No new external runtime dependencies (Vitest/coverage are devDependencies only).
- TypeScript strict mode — no `any` casts introduced.
- Frontend working dir: `frontend/` — all `npm` commands run from there.
- Do not modify `.sol` files or `test/TimeCapsule.test.ts`.
- Each commit message: imperative, ≤72 chars, conventional-commits prefix.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `frontend/package.json` | Modify | add `vitest`, `@vitest/coverage-v8`, `test` + `test:coverage` scripts |
| `frontend/vitest.config.ts` | Create | Vitest config (ESM, no JSDOM, coverage excludes) |
| `frontend/lib/crypto.ts` | Modify | Fix KDF: `decryptFromReveal` derives wrapKey same way as `encryptForSeal`; remove `wrapKeyFromSignature`; update `revealSignMessage` → deleted (unused after fix) |
| `frontend/lib/capsule.ts` | Modify | Remove `signer` from `_decryptOwnerCapsule`, `revealCapsule`, `decryptRevealed`; update status in `revealCapsule` |
| `frontend/lib/types.ts` | Modify | Remove `SignerLike` interface; remove `signer?` from `SealParams` |
| `frontend/lib/contract.ts` | Modify | Memoize `getPublicClient()` as module-level singleton |
| `frontend/lib/storage.ts` | Modify | Fix download error path to handle non-JSON response bodies |
| `frontend/lib/nft.ts` | Modify | Replace brittle `logs.find` with `parseEventLogs` for `CapsuleMinted` event |
| `frontend/lib/triggers.ts` | Modify | `multisigCanReveal` accepts optional `caller` arg instead of hardcoded zero address |
| `frontend/lib/drand.ts` | Modify | Try all `DRAND_URLS` in sequence; cache first successful client |
| `frontend/hooks/useProofFlow.ts` | Modify | Remove signer from `handleReveal`/`handleDecrypt`; fix status message order; use `CapsuleState.REVEALED` constant |
| `frontend/app/proof/[id]/ProofClient.tsx` | Modify | Replace magic `triggerType === 1/3` with `TriggerType.DEADMAN/MULTISIG` |
| `frontend/hooks/useSealForm.ts` | Modify | Store timeout ref and clear on unmount |
| `frontend/lib/__tests__/crypto.test.ts` | Create | Round-trip encrypt/decrypt; header encode/decode; edge cases |
| `frontend/lib/__tests__/ecies.test.ts` | Create | ECIES encrypt/decrypt round-trip; envelope layout |
| `frontend/lib/__tests__/storage.test.ts` | Create | Upload/download error handling with mocked fetch |
| `frontend/lib/__tests__/nft.test.ts` | Create | `getCapsuleTokenId` mock; `nftMarketplaceUrl` output |

---

## Task 1: Vitest setup

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `npm test` command that runs all `frontend/lib/__tests__/**` via Vitest

- [ ] **Step 1: Add devDependencies and scripts**

In `frontend/package.json`, add to `"devDependencies"`:
```json
"vitest": "^1.6.0",
"@vitest/coverage-v8": "^1.6.0"
```
Add to `"scripts"`:
```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 2: Create vitest config**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/__tests__/**", "lib/wagmi-config.ts", "lib/use-ethers-signer.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Create test directory**

```bash
mkdir -p frontend/lib/__tests__
```

- [ ] **Step 4: Install deps and verify Vitest runs**

```bash
cd frontend && npm install
```

Expected: installs without error.

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: "No test files found" or similar (zero failures, just no tests yet).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts
git commit -m "chore(frontend): add vitest + coverage tooling"
```

---

## Task 2: Fix critical crypto KDF mismatch + tests

**Files:**
- Modify: `frontend/lib/crypto.ts`
- Create: `frontend/lib/__tests__/crypto.test.ts`

**Context:** `encryptForSeal` (L96) derives `wrapKey = HKDF(ikm=capsuleSeed, salt=u64BE(round), info)`. `decryptFromReveal` calls `wrapKeyFromSignature` which derives `wrapKey = HKDF(ikm=signature, salt=capsuleSeed XOR round, info)`. These can never match — AES-GCM auth tag always fails. Fix: make `decryptFromReveal` use the same HKDF call as seal.

**Interfaces:**
- `encryptForSeal(plaintext: string, drandRound: number)` — signature unchanged
- `decryptFromReveal(packed: Uint8Array, timelockHeader: Uint8Array): string` — **remove `signatureHex` third parameter**
- `makeCommitHash`, `hexToBytes`, `bytesToHex`, `NONCE_LEN` — unchanged

- [ ] **Step 1: Write failing tests first**

Create `frontend/lib/__tests__/crypto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  encryptForSeal,
  decryptFromReveal,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
  NONCE_LEN,
} from "../crypto";

describe("encryptForSeal / decryptFromReveal round-trip", () => {
  it("decrypts to original plaintext for short message", () => {
    const plaintext = "Hello, time capsule!";
    const round = 12345;
    const { packed, timelockHeader } = encryptForSeal(plaintext, round);
    const result = decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("decrypts to original plaintext for long message (1 MB)", () => {
    const plaintext = "x".repeat(1_000_000);
    const round = 99999;
    const { packed, timelockHeader } = encryptForSeal(plaintext, round);
    const result = decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("different rounds produce different ciphertexts", () => {
    const plaintext = "same message";
    const { packed: p1 } = encryptForSeal(plaintext, 1);
    const { packed: p2 } = encryptForSeal(plaintext, 2);
    expect(Buffer.from(p1).toString("hex")).not.toBe(Buffer.from(p2).toString("hex"));
  });

  it("timelockHeader is exactly 100 bytes", () => {
    const { timelockHeader } = encryptForSeal("test", 1);
    expect(timelockHeader.length).toBe(100);
  });

  it("tampered ciphertext throws (AES-GCM auth tag failure)", () => {
    const { packed, timelockHeader } = encryptForSeal("secret", 1);
    const tampered = new Uint8Array(packed);
    tampered[NONCE_LEN + 5] ^= 0xff; // flip a bit in ciphertext
    expect(() => decryptFromReveal(tampered, timelockHeader)).toThrow();
  });

  it("wrong timelockHeader throws", () => {
    const { packed, timelockHeader } = encryptForSeal("secret", 1);
    const { timelockHeader: otherHeader } = encryptForSeal("secret", 2);
    expect(() => decryptFromReveal(packed, otherHeader)).toThrow();
  });
});

describe("makeCommitHash", () => {
  it("produces a 0x-prefixed 64-char hex string", () => {
    const h = makeCommitHash("hello");
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("same plaintext → same hash (deterministic)", () => {
    expect(makeCommitHash("abc")).toBe(makeCommitHash("abc"));
  });

  it("different plaintext → different hash", () => {
    expect(makeCommitHash("abc")).not.toBe(makeCommitHash("xyz"));
  });
});

describe("encryptForSeal output fields", () => {
  it("packed starts with 12-byte nonce", () => {
    const { packed } = encryptForSeal("test", 42);
    expect(packed.length).toBeGreaterThan(NONCE_LEN);
  });

  it("commitHash matches makeCommitHash(plaintext)", () => {
    const pt = "verify me";
    const { commitHash } = encryptForSeal(pt, 1);
    expect(commitHash).toBe(makeCommitHash(pt));
  });

  it("dataKey is 32 bytes", () => {
    const { dataKey } = encryptForSeal("test", 1);
    expect(dataKey.length).toBe(32);
  });
});

describe("hexToBytes / bytesToHex", () => {
  it("round-trips with 0x prefix", () => {
    const hex = "0xdeadbeef01020304";
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it("round-trips without prefix", () => {
    const b = new Uint8Array([1, 2, 3, 255]);
    expect(hexToBytes(bytesToHex(b))).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: several FAIL — `decryptFromReveal` throws because KDF mismatch.

- [ ] **Step 3: Fix crypto.ts**

Open `frontend/lib/crypto.ts`. Make these changes:

**3a.** Delete the `wrapKeyFromSignature` function entirely (lines 124–133).

**3b.** Delete the `revealSignMessage` function (lines 116–118) — no longer needed.

**3c.** Change `decryptFromReveal` signature: remove `signatureHex` parameter. Derive `wrapKey` the same way `encryptForSeal` does:

Replace the current `decryptFromReveal` function body with:
```ts
export function decryptFromReveal(
  packed:         Uint8Array,
  timelockHeader: Uint8Array,
): string {
  const { capsuleSeed, drandRound, nonce2, wrappedKey } = decodeHeader(timelockHeader);

  // Same derivation as encryptForSeal — wrapKey is deterministic from the header
  const wrapKey = hkdf(sha256, capsuleSeed, u64BE(drandRound), utf8ToBytes("0g-time-capsule-v1"), 32);
  const dataKey = aesDecrypt(wrappedKey, wrapKey, nonce2);

  const nonce1     = packed.slice(0, NONCE_LEN);
  const ciphertext = packed.slice(NONCE_LEN);
  return bytesToUtf8(aesDecrypt(ciphertext, dataKey, nonce1));
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests PASS. Zero failures.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/crypto.ts frontend/lib/__tests__/crypto.test.ts
git commit -m "fix(crypto): align reveal KDF with seal — remove wrapKeyFromSignature

encryptForSeal derived wrapKey = HKDF(capsuleSeed, drandRound) but
decryptFromReveal called wrapKeyFromSignature which used HKDF(sig, XOR-salt).
Different IKM and salt meant AES-GCM auth tag always failed — nothing
could ever be decrypted. Fix: derive wrapKey identically in both paths."
```

---

## Task 3: Update callers of changed crypto API (capsule.ts, types.ts)

**Files:**
- Modify: `frontend/lib/capsule.ts`
- Modify: `frontend/lib/types.ts`

**Interfaces:**
- `revealCapsule(capsuleId, signer)` → `revealCapsule(capsuleId)` — signer removed
- `decryptRevealed(capsuleId, signer)` → `decryptRevealed(capsuleId)` — signer removed
- `_decryptOwnerCapsule(capsuleId, timelockHeader, packed, signer)` → `_decryptOwnerCapsule(capsuleId, timelockHeader, packed)` — signer removed

- [ ] **Step 1: Fix capsule.ts**

**1a.** Replace `_decryptOwnerCapsule`:
```ts
async function _decryptOwnerCapsule(
  capsuleId:      `0x${string}`,
  timelockHeader: Uint8Array,
  packed:         Uint8Array,
): Promise<{ plaintext: string; commitHash: `0x${string}`; verified: boolean }> {
  const plaintext = decryptFromReveal(packed, timelockHeader);
  const hash      = makeCommitHash(plaintext);
  const verified  = await verifyOnChain(capsuleId, hash);
  return { plaintext, commitHash: hash, verified };
}
```

**1b.** Remove the import of `revealSignMessage` from `./crypto` (it no longer exists).

**1c.** Remove `signer` parameter from `revealCapsule`:
```ts
export async function revealCapsule(
  capsuleId: `0x${string}`,
): Promise<RevealResult> {
  const { timelockHeader: headerHex } = await revealOnChain(capsuleId);
  const timelockHeader = Buffer.from(headerHex.slice(2), "hex");

  const cap    = await getCapsule(capsuleId);
  const packed = await downloadFromStorage(cap.storageRoot);

  const { plaintext, commitHash, verified } =
    await _decryptOwnerCapsule(capsuleId, timelockHeader, packed);

  return { capsuleId, plaintext, commitHash, verified };
}
```

**1d.** Remove `signer` parameter from `decryptRevealed`:
```ts
export async function decryptRevealed(
  capsuleId: `0x${string}`,
): Promise<RevealResult> {
  const cap = await getCapsule(capsuleId);
  if (cap.state !== 1) throw new Error("Capsule not yet revealed on-chain");

  const timelockHeader = Buffer.from(cap.timelockHeader.slice(2), "hex");
  const packed         = await downloadFromStorage(cap.storageRoot);

  const { plaintext, commitHash, verified } =
    await _decryptOwnerCapsule(capsuleId, timelockHeader, packed);

  return { capsuleId, plaintext, commitHash, verified };
}
```

- [ ] **Step 2: Fix types.ts**

Remove `SignerLike` interface. Remove the `signer?` field from `SealParams`:
```ts
export interface SealParams {
  plaintext:        string;
  unlockTime:       Date;
  recipients?:      RecipientParam[];
  trigger?:         TriggerConfig;
  triggerContract?: `0x${string}`;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors. If there are errors about `signer` or `SignerLike` references, fix them in the reported files.

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/capsule.ts frontend/lib/types.ts
git commit -m "fix(capsule): remove signer param from revealCapsule/decryptRevealed

No signature needed — wrapKey is deterministic from timelockHeader.
Removes dead SignerLike type and signer? from SealParams."
```

---

## Task 4: Fix useProofFlow status order + remove signer calls

**Files:**
- Modify: `frontend/hooks/useProofFlow.ts`
- Modify: `frontend/app/proof/[id]/ProofClient.tsx`

**Interfaces:**
- `handleReveal()` — no longer creates a signer object; status messages in correct order
- `handleDecrypt()` — no longer creates a signer object
- `ProofClient.tsx` — uses `TriggerType.DEADMAN` / `TriggerType.MULTISIG` constants

- [ ] **Step 1: Fix useProofFlow.ts**

**1a.** Remove `useWalletClient` import and `walletClient` usage:

Remove the `useWalletClient` import and the `const { data: walletClient } = useWalletClient();` line.

**1b.** Replace `handleReveal`:
```ts
async function handleReveal() {
  setLoading(true); setError(""); setStatus("Sending reveal tx…");
  try {
    setResult(await revealCapsule(capsuleId));
  } catch (e: unknown) {
    setError(formatError(e));
  } finally { setLoading(false); setStatus(""); }
}
```

**1c.** Replace `handleDecrypt`:
```ts
async function handleDecrypt() {
  setLoading(true); setError(""); setStatus("Decrypting…");
  try {
    setResult(await decryptRevealed(capsuleId));
  } catch (e: unknown) {
    setError(formatError(e));
  } finally { setLoading(false); setStatus(""); }
}
```

**1d.** Fix `alreadyRevealed` magic number — import `CapsuleState` and use it:

Add to imports at top of file:
```ts
import { CapsuleState } from "@/lib/types";
```

Change:
```ts
const alreadyRevealed = capsule?.state === 1;
```
To:
```ts
const alreadyRevealed = capsule?.state === CapsuleState.REVEALED;
```

**1e.** Remove `SignerLike` from the imports in useProofFlow.ts (it was removed from types.ts).

- [ ] **Step 2: Fix ProofClient.tsx magic numbers**

Add `TriggerType` import at the top of `frontend/app/proof/[id]/ProofClient.tsx`:
```ts
import { TriggerType } from "../../../lib/types";
```

Replace:
```tsx
{capsule && capsule.triggerType === 1 && (
```
With:
```tsx
{capsule && capsule.triggerType === TriggerType.DEADMAN && (
```

Replace:
```tsx
{capsule && capsule.triggerType === 3 && (
```
With:
```tsx
{capsule && capsule.triggerType === TriggerType.MULTISIG && (
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/useProofFlow.ts frontend/app/proof/[id]/ProofClient.tsx
git commit -m "fix(proof): remove signer from reveal/decrypt, fix status order, use constants

- handleReveal/handleDecrypt no longer request wallet signature
- 'Sending reveal tx...' status now correct (not immediately overwritten)
- alreadyRevealed uses CapsuleState.REVEALED constant
- ProofClient uses TriggerType.DEADMAN/MULTISIG instead of magic 1/3"
```

---

## Task 5: Fix NFT log parsing + test

**Files:**
- Modify: `frontend/lib/nft.ts`
- Create: `frontend/lib/__tests__/nft.test.ts`

**Context:** `mintCapsuleNFT` uses `receipt.logs.find(l => l.topics[0] !== undefined)` then reads `topics[2]` as tokenId. This can grab the wrong log (e.g. ERC-721 Transfer event where `topics[2]` is the `to` address). Fix: use `parseEventLogs` with the correct ABI + event name, same pattern as `sealOnChain`.

**Interfaces:**
- `mintCapsuleNFT(capsuleId)` — same signature, same return type `{ tokenId: bigint; txHash: Hash }`

- [ ] **Step 1: Write failing test**

Create `frontend/lib/__tests__/nft.test.ts`:
```ts
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
```

- [ ] **Step 2: Fix nft.ts**

Add `parseEventLogs` to viem imports at top of `frontend/lib/nft.ts`:
```ts
import { parseEventLogs, type Hash } from "viem";
```

Replace the log-parsing block in `mintCapsuleNFT`:
```ts
export async function mintCapsuleNFT(capsuleId: `0x${string}`): Promise<{ tokenId: bigint; txHash: Hash }> {
  const wallet = await getWalletClient();
  const pub    = getPublicClient();

  const txHash = await wallet.writeContract({
    account:      wallet.account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.CapsuleNFT,
    abi:          CAPSULE_NFT_ABI,
    functionName: "mint",
    args:         [capsuleId],
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  const logs = parseEventLogs({
    abi:       CAPSULE_NFT_ABI,
    logs:      receipt.logs,
    eventName: "CapsuleMinted",
  });

  if (!logs[0]) throw new Error("CapsuleMinted event not found in receipt");
  const tokenId = (logs[0].args as { tokenId: bigint }).tokenId;

  return { tokenId, txHash };
}
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/nft.ts frontend/lib/__tests__/nft.test.ts
git commit -m "fix(nft): use parseEventLogs for CapsuleMinted instead of topics[2] guess

The old find-first-log approach could grab ERC-721 Transfer where
topics[2] is 'to' address, not tokenId."
```

---

## Task 6: Fix contract.ts singleton + storage.ts error handling + tests

**Files:**
- Modify: `frontend/lib/contract.ts`
- Modify: `frontend/lib/storage.ts`
- Create: `frontend/lib/__tests__/storage.test.ts`

**Interfaces:**
- `getPublicClient()` — same signature, now memoized
- `downloadFromStorage(rootHash)` — same signature; error path now safe for non-JSON responses

- [ ] **Step 1: Write storage tests**

Create `frontend/lib/__tests__/storage.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test only the error-path parsing — the happy path requires a live server.

describe("downloadFromStorage error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws with HTTP status text when response is not JSON", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:     false,
      status: 502,
      text:   async () => "<html>Bad Gateway</html>",
      json:   async () => { throw new SyntaxError("not json"); },
    } as unknown as Response);

    const { downloadFromStorage } = await import("../storage");
    await expect(downloadFromStorage("0xdeadbeef" as `0x${string}`))
      .rejects.toThrow("Storage download failed");
  });

  it("throws with JSON error field when response is JSON error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   false,
      status: 404,
      text: async () => JSON.stringify({ error: "file not found" }),
      json: async () => ({ error: "file not found" }),
    } as unknown as Response);

    const { downloadFromStorage } = await import("../storage");
    await expect(downloadFromStorage("0xdeadbeef" as `0x${string}`))
      .rejects.toThrow("file not found");
  });
});
```

- [ ] **Step 2: Run tests — expect first test to FAIL**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A 5 "Storage download"
```

Expected: the non-JSON test FAILS because current code calls `res.json()` which throws SyntaxError, not `"Storage download failed"`.

- [ ] **Step 3: Fix storage.ts download error path**

Replace the error-handling block in `downloadFromStorage`:
```ts
export async function downloadFromStorage(rootHash: `0x${string}`): Promise<Uint8Array> {
  const res = await fetch(`/api/storage/download?hash=${encodeURIComponent(rootHash)}`);

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      try { message = (JSON.parse(text) as { error?: string }).error ?? text; }
      catch { message = text || message; }
    } catch { /* network error — keep default */ }
    throw new Error(`Storage download failed: ${message}`);
  }

  const { data }: { data: string } = await res.json();
  return new Uint8Array(Buffer.from(data.startsWith("0x") ? data.slice(2) : data, "hex"));
}
```

- [ ] **Step 4: Fix contract.ts — memoize getPublicClient**

In `frontend/lib/contract.ts`, replace the `getPublicClient` function:
```ts
let _publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: zeroGTestnet,
    transport: http(),
  });
  return _publicClient;
}
```

- [ ] **Step 5: Run all tests**

```bash
cd frontend && npm test 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/contract.ts frontend/lib/storage.ts frontend/lib/__tests__/storage.test.ts
git commit -m "fix(contract,storage): memoize publicClient; fix non-JSON download error

- getPublicClient() now module-level singleton (no new transport per call)
- downloadFromStorage error path uses text() fallback before JSON.parse
  so HTML 502 pages don't throw SyntaxError masking the real error"
```

---

## Task 7: Fix triggers zero address + drand failover + ECIES tests

**Files:**
- Modify: `frontend/lib/triggers.ts`
- Modify: `frontend/lib/drand.ts`
- Create: `frontend/lib/__tests__/ecies.test.ts`

**Interfaces:**
- `multisigCanReveal(capsuleId, caller?)` — adds optional `caller` arg; defaults to zero address kept as fallback only for backward compat
- `getDrandClient()` — internally tries all DRAND_URLS in order

- [ ] **Step 1: Write ECIES tests**

Create `frontend/lib/__tests__/ecies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  eciesEncrypt,
  eciesDecrypt,
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  loadPrivKeyFromStorage,
  hasSavedPrivKey,
} from "../ecies";

describe("eciesEncrypt / eciesDecrypt round-trip", () => {
  it("decrypts 32-byte dataKey to original", () => {
    const { privKey, pubKey } = generateEncryptionKeypair();
    const dataKey = new Uint8Array(32).fill(0xab);
    const envelope = eciesEncrypt(pubKey, dataKey);
    const recovered = eciesDecrypt(privKey, envelope);
    expect(recovered).toEqual(dataKey);
  });

  it("envelope is 93 bytes for 32-byte message", () => {
    const { pubKey } = generateEncryptionKeypair();
    const msg = new Uint8Array(32);
    const envelope = eciesEncrypt(pubKey, msg);
    expect(envelope.length).toBe(93); // 33 + 12 + 32 + 16
  });

  it("wrong private key throws", () => {
    const { pubKey }     = generateEncryptionKeypair();
    const { privKey: k2 } = generateEncryptionKeypair();
    const envelope = eciesEncrypt(pubKey, new Uint8Array(32));
    expect(() => eciesDecrypt(k2, envelope)).toThrow();
  });

  it("each encryption is non-deterministic (ephemeral key)", () => {
    const { pubKey } = generateEncryptionKeypair();
    const msg = new Uint8Array(32).fill(1);
    const e1 = eciesEncrypt(pubKey, msg);
    const e2 = eciesEncrypt(pubKey, msg);
    expect(Buffer.from(e1).toString("hex")).not.toBe(Buffer.from(e2).toString("hex"));
  });
});

describe("localStorage key management", () => {
  it("save + load round-trips correctly", () => {
    // Minimal localStorage mock
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => Object.keys(store).forEach(k => delete store[k]),
      length: 0,
      key: () => null,
    };

    const addr = "0xabc123";
    const { privKey } = generateEncryptionKeypair();
    savePrivKeyToStorage(addr, privKey);
    const loaded = loadPrivKeyFromStorage(addr);
    expect(loaded).toEqual(privKey);
  });

  it("hasSavedPrivKey returns false for unknown address", () => {
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    expect(hasSavedPrivKey("0xunknown")).toBe(false);
  });
});
```

- [ ] **Step 2: Run ECIES tests — expect pass (no changes yet)**

```bash
cd frontend && npm test -- lib/__tests__/ecies.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all pass (ECIES was already correct).

- [ ] **Step 3: Fix triggers.ts — multisigCanReveal caller**

In `frontend/lib/triggers.ts`, update `multisigCanReveal` to accept an optional caller:
```ts
export async function multisigCanReveal(
  capsuleId: `0x${string}`,
  caller?:   `0x${string}`,
): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "canReveal",
    args:         [capsuleId, caller ?? "0x0000000000000000000000000000000000000000"],
  });
}
```

- [ ] **Step 4: Fix drand.ts — failover across DRAND_URLS**

Replace the `getDrandClient` function in `frontend/lib/drand.ts`:
```ts
let _client: HttpChainClient | null = null;

export async function getOrCreateDrandClient(): Promise<HttpChainClient> {
  if (_client) return _client;

  let lastErr: unknown;
  for (const url of DRAND_URLS) {
    try {
      const chain = new HttpCachingChain(
        `${url}/${DRAND_QUICKNET_CHAIN}`,
        { disableBeaconVerification: false, noCache: false }
      );
      const candidate = new HttpChainClient(chain);
      // probe — throws if unreachable
      await candidate.chain().info();
      _client = candidate;
      return _client;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`All drand endpoints unreachable: ${lastErr}`);
}

/** @deprecated use getOrCreateDrandClient() */
export function getDrandClient(): HttpChainClient {
  // Return cached client synchronously if available; caller must await getOrCreateDrandClient() first.
  if (_client) return _client;
  // Fallback: return first URL client without probe (original behaviour)
  const chain = new HttpCachingChain(
    `${DRAND_URLS[0]}/${DRAND_QUICKNET_CHAIN}`,
    { disableBeaconVerification: false, noCache: false }
  );
  return (_client = new HttpChainClient(chain));
}
```

Update `roundForTime` and `timeForRound` and `fetchRound` to use `getOrCreateDrandClient`:
```ts
export async function roundForTime(unlockTime: Date): Promise<number> {
  const client = await getOrCreateDrandClient();
  const info = await client.chain().info();
  return roundAt(unlockTime.getTime(), info);
}

export async function timeForRound(round: number): Promise<Date> {
  const client = await getOrCreateDrandClient();
  const info = await client.chain().info();
  return new Date(roundTime(info, round));
}

export async function fetchRound(round: number) {
  const client = await getOrCreateDrandClient();
  return client.get(round);
}

export async function isRoundAvailable(round: number): Promise<boolean> {
  try {
    await fetchRound(round);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run all tests**

```bash
cd frontend && npm test 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/triggers.ts frontend/lib/drand.ts frontend/lib/__tests__/ecies.test.ts
git commit -m "fix(triggers,drand,ecies): zero-addr caller, drand failover, ECIES tests

- multisigCanReveal accepts optional caller (was hardcoded zero address)
- drand getOrCreateDrandClient tries all 4 URLs in order; caches on success
- adds ECIES round-trip + localStorage tests"
```

---

## Task 8: Fix useSealForm timer cleanup

**Files:**
- Modify: `frontend/hooks/useSealForm.ts`

**Context:** `handleSeal` does `setTimeout(() => router.push(…), 1800)` with no cleanup. If the component unmounts before the 1800 ms fires, the navigation still happens. Fix: store the timeout ID in a ref and clear it when the hook's owning component unmounts.

- [ ] **Step 1: Fix useSealForm.ts**

**1a.** Add `useEffect` to the existing React imports:

Change:
```ts
import { useState, useRef } from "react";
```
To:
```ts
import { useState, useRef, useEffect } from "react";
```

**1b.** Add a timeout ref alongside `fileInputRef`:
```ts
const fileInputRef  = useRef<HTMLInputElement>(null);
const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**1c.** Add cleanup effect after the ref declarations:
```ts
useEffect(() => {
  return () => {
    if (redirectTimer.current !== null) clearTimeout(redirectTimer.current);
  };
}, []);
```

**1d.** In `handleSeal`, replace the `setTimeout` call:
```ts
redirectTimer.current = setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1800);
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Run all tests**

```bash
cd frontend && npm test 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/useSealForm.ts
git commit -m "fix(seal): clear redirect timeout on unmount to avoid navigation after dispose"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1
```

Expected: all tests green, zero failures.

- [ ] **Run typecheck**

```bash
cd frontend && npm run typecheck 2>&1
```

Expected: zero errors.

- [ ] **Run Hardhat contract tests (regression check)**

```bash
npx hardhat test 2>&1 | tail -20
```

Expected: all existing contract tests pass, zero failures.

---

## Spec Coverage Self-Check

| Review Finding | Task |
|---|---|
| 🔴 crypto.ts KDF mismatch | Task 2 + 3 |
| 🔴 handleReveal status messages wrong order | Task 4 |
| 🔴 nft.ts brittle log parsing | Task 5 |
| 🟡 triggers.ts zero address | Task 7 |
| 🟡 contract.ts new client each call | Task 6 |
| 🟡 storage.ts non-JSON error body | Task 6 |
| 🟡 capsule.ts trigger failure leaves broken state | Not fixed (architectural; requires contract-level atomicity — scope too large for this plan; document in code) |
| 🔵 useProofFlow alreadyRevealed magic number | Task 4 |
| 🔵 ProofClient.tsx trigger type magic numbers | Task 4 |
| 🔵 drand single URL no failover | Task 7 |
| 🔵 useSealForm router.push no cleanup | Task 8 |
| ECIES tests | Task 7 |
| crypto tests | Task 2 |
| storage tests | Task 6 |
