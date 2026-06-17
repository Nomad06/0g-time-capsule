# SOLID / KISS / DRY Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 identified SOLID/KISS/DRY violations across `lib/`, `hooks/`, `app/`, and `app/api/` to make the codebase maintainable, type-safe, and free of scattered duplication.

**Architecture:** Introduce a shared `lib/utils.ts` utilities layer first, then refactor types → contract → capsule in dependency order, then extract React hooks, then update components and API routes to consume the new abstractions.

**Tech Stack:** Next.js 14, TypeScript 5, viem, wagmi, @noble/ciphers

## Global Constraints

- No new npm dependencies
- Every task must pass `npm run typecheck` (`tsc --noEmit`) before commit
- Do not change any public function signatures visible to components unless the task explicitly says to; update all callers in the same task
- Run from `frontend/` directory for all commands

---

## File Map

| File | Status | Responsibility after refactor |
|------|--------|-------------------------------|
| `frontend/lib/utils.ts` | **Create** | `formatError`, `normalizeHash` shared utilities |
| `frontend/lib/crypto.ts` | **Modify** | Export `NONCE_LEN` constant |
| `frontend/lib/types.ts` | **Modify** | `SignerLike` interface; `TriggerConfig` discriminated union; clean `SealParams` |
| `frontend/lib/contract.ts` | **Modify** | `writeAndWait` helper; merged `readCapsulesByRole`; remove 50-line duplication |
| `frontend/lib/capsule.ts` | **Modify** | Private stage helpers; merged decrypt core; no dynamic imports; typed `signer` |
| `frontend/hooks/usePoll.ts` | **Create** | Reusable polling hook |
| `frontend/hooks/useSealForm.ts` | **Create** | All seal-form state + `handleSeal` extracted from page |
| `frontend/hooks/useProofFlow.ts` | **Create** | Proof-page state + handlers extracted from ProofClient |
| `frontend/app/seal/page.tsx` | **Modify** | Consume `useSealForm`; ~200 lines of pure render |
| `frontend/app/proof/[id]/ProofClient.tsx` | **Modify** | Consume `useProofFlow` + `usePoll`; DRY error handling |
| `frontend/app/api/storage/download/route.ts` | **Modify** | Size guard; use `normalizeHash` |
| `frontend/app/api/storage/upload/route.ts` | **Modify** | Use `normalizeHash` |

---

## Task 1: Shared utilities — `lib/utils.ts` + export `NONCE_LEN`

**Files:**
- Create: `frontend/lib/utils.ts`
- Modify: `frontend/lib/crypto.ts` (line 15 — `const NONCE_LEN = 12` → `export const NONCE_LEN = 12`)

**Interfaces:**
- Produces: `formatError(e: unknown): string`, `normalizeHash(h: string): string`, `export const NONCE_LEN: 12`

- [ ] **Step 1: Create `lib/utils.ts`**

```typescript
// frontend/lib/utils.ts

/** Convert caught error to a string without losing the message. */
export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Strip a leading "0x" prefix from a hex string.
 * Safe to call on already-stripped strings.
 */
export function normalizeHash(h: string): string {
  return h.startsWith("0x") ? h.slice(2) : h;
}
```

- [ ] **Step 2: Export `NONCE_LEN` from `lib/crypto.ts`**

In `frontend/lib/crypto.ts`, find the line:
```typescript
const NONCE_LEN = 12;
```
Change it to:
```typescript
export const NONCE_LEN = 12;
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/utils.ts frontend/lib/crypto.ts
git commit -m "feat(lib): add shared utils (formatError, normalizeHash) and export NONCE_LEN"
```

---

## Task 2: Discriminated trigger union + `SignerLike` — `lib/types.ts`

**Files:**
- Modify: `frontend/lib/types.ts`

**Interfaces:**
- Produces: `SignerLike`, `TriggerConfig` (discriminated union), updated `SealParams`
- Callers of `SealParams` are updated in Task 5 (capsule.ts) and Task 7 (seal/page.tsx)

**Why:** `SealParams` currently has `triggerType?`, `deadman?`, and `multisig?` as flat optional fields. Wrong config is silently ignored at runtime (e.g., setting `deadman` when `triggerType === MULTISIG`). A discriminated union enforces correct configs at compile time.

- [ ] **Step 1: Add `SignerLike` and `TriggerConfig`, update `SealParams`**

Replace the block from line 38 (`// Stage 3: trigger configs`) through line 58 (end of `SealParams`) with:

```typescript
// ── Trigger configs (discriminated union) ─────────────────────────────────────

/** Minimal signer interface — compatible with wagmi/viem account objects. */
export interface SignerLike {
  signMessage(message: string): Promise<string>;
}

export type TriggerConfig =
  | { type: typeof TriggerType.TIME }
  | { type: typeof TriggerType.DEADMAN;  intervalDays: number }
  | { type: typeof TriggerType.MULTISIG; signers: `0x${string}`[]; threshold: number };

export interface SealParams {
  plaintext:        string;            // UTF-8 message
  unlockTime:       Date;              // JS Date → unix timestamp on-chain
  signer:           SignerLike;        // signs commitHash to derive wrapKey
  recipients?:      RecipientParam[];  // empty = public; Stage 2: each gets ECIES key
  trigger?:         TriggerConfig;     // undefined = TIME trigger
  triggerContract?: `0x${string}`;
}
```

Also **delete** the now-unused interfaces (they were only used by `SealParams`):

```typescript
// DELETE these two interfaces — no longer needed:
export interface DeadManSwitchConfig {
  intervalDays: number;
}

export interface MultiSigConfig {
  signers:   `0x${string}`[];
  threshold: number;
}
```

- [ ] **Step 2: Typecheck (expect errors — callers not yet updated)**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | head -20
```
Expected: errors in `capsule.ts` and `seal/page.tsx` because they still use `params.triggerType` / `params.deadman` / `params.multisig`. These are fixed in Tasks 5 and 7.

- [ ] **Step 3: Commit (with typecheck errors noted)**

```bash
git add frontend/lib/types.ts
git commit -m "refactor(types): discriminated TriggerConfig union, SignerLike interface"
```

---

## Task 3: DRY contract helpers — `lib/contract.ts`

**Files:**
- Modify: `frontend/lib/contract.ts`

**Interfaces:**
- Produces: private `writeAndWait(wallet, args)`, private `readCapsulesByRole(fn, addr)`
- Public API (`sealOnChain`, `revealOnChain`, etc.) unchanged

**Why:** `setRecipientKeys` and `registerEncryptionKey` each repeat the same 4-line pattern (wallet + pub + writeContract + waitForReceipt). `getOwnerCapsules` and `getRecipientCapsules` are identical except for function name.

- [ ] **Step 1: Add `writeAndWait` private helper after `getWalletClient` (after line 41)**

Insert after the closing `}` of `getWalletClient`:

```typescript
// ── Private helpers ────────────────────────────────────────────────────────────

type WriteContractArgs = Parameters<WalletClient["writeContract"]>[0];

/**
 * Wallet write + receipt wait in one call.
 * Injects account and chain so callers don't repeat them.
 */
async function writeAndWait(args: Omit<WriteContractArgs, "account" | "chain">): Promise<Hash> {
  const wallet = await getWalletClient();
  const pub    = getPublicClient();
  const txHash = await wallet.writeContract({
    ...args,
    account: wallet.account,
    chain:   zeroGTestnet,
  } as WriteContractArgs);
  await pub.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
```

- [ ] **Step 2: Add `readCapsulesByRole` private helper before `getOwnerCapsules`**

Insert just above `getOwnerCapsules` (line 177):

```typescript
async function readCapsulesByRole(
  functionName: "getOwnerCapsules" | "getRecipientCapsules",
  address: `0x${string}`
): Promise<`0x${string}`[]> {
  const pub = getPublicClient();
  const ids = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName,
    args:         [address],
  });
  return ids as `0x${string}`[];
}
```

- [ ] **Step 3: Collapse `getOwnerCapsules` and `getRecipientCapsules` to one-liners**

Replace the current `getOwnerCapsules` and `getRecipientCapsules` implementations (lines 177–197) with:

```typescript
export const getOwnerCapsules     = (owner:     `0x${string}`) => readCapsulesByRole("getOwnerCapsules",     owner);
export const getRecipientCapsules = (recipient: `0x${string}`) => readCapsulesByRole("getRecipientCapsules", recipient);
```

- [ ] **Step 4: Simplify `setRecipientKeys` to use `writeAndWait`**

Replace the body of `setRecipientKeys` (lines 201–221) with:

```typescript
export async function setRecipientKeys(
  capsuleId:     `0x${string}`,
  recipients:    `0x${string}`[],
  encryptedKeys: `0x${string}`[]
): Promise<Hash> {
  return writeAndWait({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "setRecipientKeys",
    args:         [capsuleId, recipients, encryptedKeys],
  });
}
```

- [ ] **Step 5: Simplify `registerEncryptionKey` to use `writeAndWait`**

Replace the body of `registerEncryptionKey` (lines 239–255) with:

```typescript
export async function registerEncryptionKey(pubkeyHex: `0x${string}`): Promise<Hash> {
  return writeAndWait({
    address:      CONTRACT_ADDRESSES.KeyRegistry,
    abi:          KEY_REGISTRY_ABI,
    functionName: "registerKey",
    args:         [pubkeyHex],
  });
}
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | grep "contract"
```
Expected: no errors in contract.ts (other tasks may still have errors).

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/contract.ts
git commit -m "refactor(contract): extract writeAndWait + readCapsulesByRole, remove duplication"
```

---

## Task 4: Refactor `lib/capsule.ts` — stages, merged decrypt, typed signer

**Files:**
- Modify: `frontend/lib/capsule.ts`

**Interfaces:**
- Consumes: `TriggerConfig`, `SignerLike`, `NONCE_LEN` from Task 1–3
- Public API unchanged: `sealCapsule`, `revealCapsule`, `decryptAsRecipient`, `decryptRevealed`

**Why:**
1. `sealCapsule` mixes 6 concerns in 60 lines — extract 3 private stage helpers
2. `revealCapsule` and `decryptRevealed` have ~30 lines of duplicate decrypt logic — extract `_decryptOwnerCapsule`
3. Dynamic `await import("./contract")` on lines 86/93 is unnecessary — `getWalletClient` can be imported statically
4. `signer: any` — replace with `SignerLike`
5. `NONCE_LEN = 12` inline — import from crypto.ts

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `capsule.ts` with:

```typescript
import {
  encryptForSeal,
  decryptFromReveal,
  sealSignMessage,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
  NONCE_LEN,
} from "./crypto";
import { eciesEncrypt, eciesDecrypt } from "./ecies";
import { uploadToStorage, downloadFromStorage } from "./storage";
import {
  sealOnChain,
  revealOnChain,
  getCapsule,
  verifyOnChain,
  setRecipientKeys,
  getRecipientKey,
  getWalletClient,
} from "./contract";
import { armSwitch, createVault } from "./triggers";
import { roundForTime } from "./drand";
import { TriggerType } from "./types";
import type { SealParams, SealResult, RevealResult, SignerLike, TriggerConfig, RecipientParam } from "./types";
```

- [ ] **Step 2: Add private stage helpers before `sealCapsule`**

Insert these three private functions before the `// ── Seal ──` section:

```typescript
// ── Private stage helpers ──────────────────────────────────────────────────────

async function _buildEncryption(params: SealParams) {
  const drandRound = await roundForTime(params.unlockTime);
  const commitHash = makeCommitHash(params.plaintext);
  const ownerSig   = await params.signer.signMessage(sealSignMessage(commitHash));
  return { drandRound, commitHash, ...encryptForSeal(params.plaintext, drandRound, ownerSig) };
}

async function _distributeRecipientKeys(
  capsuleId:  `0x${string}`,
  recipients: RecipientParam[],
  dataKey:    Uint8Array
) {
  if (recipients.length === 0) return;
  await setRecipientKeys(
    capsuleId,
    recipients.map(r => r.address),
    recipients.map(r => bytesToHex(eciesEncrypt(r.pubkey, dataKey)))
  );
}

async function _setupTrigger(capsuleId: `0x${string}`, trigger?: TriggerConfig) {
  if (!trigger || trigger.type === TriggerType.TIME) return;
  const { account } = await getWalletClient();
  if (trigger.type === TriggerType.DEADMAN) {
    await armSwitch(capsuleId, account.address, BigInt(trigger.intervalDays * 86400));
  } else {
    // TriggerType.MULTISIG
    await createVault(capsuleId, account.address, trigger.signers, trigger.threshold);
  }
}
```

- [ ] **Step 3: Replace `sealCapsule` body**

Replace the existing `sealCapsule` function with:

```typescript
export async function sealCapsule(params: SealParams): Promise<SealResult> {
  if (!params.plaintext.trim())       throw new Error("Plaintext cannot be empty");
  if (params.unlockTime <= new Date()) throw new Error("Unlock time must be in the future");

  const { drandRound, commitHash, packed, timelockHeader, dataKey } =
    await _buildEncryption(params);

  const { rootHash: storageRoot } = await uploadToStorage(packed);

  const { txHash, capsuleId } = await sealOnChain({
    storageRoot,
    commitHash,
    timelockHeader: `0x${Buffer.from(timelockHeader).toString("hex")}`,
    unlockTime:     BigInt(Math.floor(params.unlockTime.getTime() / 1000)),
    recipients:     (params.recipients ?? []).map(r => r.address),
    triggerType:    params.trigger?.type ?? TriggerType.TIME,
    triggerContract: params.triggerContract,
  });

  await _distributeRecipientKeys(capsuleId, params.recipients ?? [], dataKey);
  await _setupTrigger(capsuleId, params.trigger);

  return { capsuleId, storageRoot, commitHash, drandRound, txHash };
}
```

- [ ] **Step 4: Extract shared decrypt core + rewrite `revealCapsule` and `decryptRevealed`**

Add private helper after `sealCapsule`:

```typescript
async function _decryptOwnerCapsule(
  capsuleId: `0x${string}`,
  signer:    SignerLike
): Promise<RevealResult> {
  const cap = await getCapsule(capsuleId);
  if (cap.state !== 1) throw new Error("Capsule not yet revealed on-chain");

  const timelockHeader = Buffer.from((cap.timelockHeader as string).slice(2), "hex");
  const packed         = await downloadFromStorage(cap.storageRoot);
  const signatureHex   = await signer.signMessage(sealSignMessage(cap.commitHash as `0x${string}`));
  const plaintext      = decryptFromReveal(packed, timelockHeader, signatureHex);
  const hash           = makeCommitHash(plaintext);
  const verified       = await verifyOnChain(capsuleId, hash);

  return { capsuleId, plaintext, commitHash: hash, verified };
}
```

Replace `revealCapsule`:

```typescript
export async function revealCapsule(
  capsuleId: `0x${string}`,
  signer:    SignerLike
): Promise<RevealResult> {
  const existing = await getCapsule(capsuleId);
  if (existing.state === 1) return _decryptOwnerCapsule(capsuleId, signer);

  await revealOnChain(capsuleId);
  return _decryptOwnerCapsule(capsuleId, signer);
}
```

Replace `decryptRevealed`:

```typescript
export async function decryptRevealed(
  capsuleId: `0x${string}`,
  signer:    SignerLike
): Promise<RevealResult> {
  return _decryptOwnerCapsule(capsuleId, signer);
}
```

- [ ] **Step 5: Fix `decryptAsRecipient` — replace inline `NONCE_LEN = 12` with the imported constant**

In `decryptAsRecipient`, find:
```typescript
const NONCE_LEN = 12;
```
Delete that line — `NONCE_LEN` is now imported from `./crypto`.

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | grep "capsule"
```
Expected: errors only in `seal/page.tsx` (still uses old `triggerType`/`deadman`/`multisig` fields) — fixed in Task 7.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/capsule.ts
git commit -m "refactor(capsule): extract stage helpers, merge decrypt paths, typed signer, drop dynamic imports"
```

---

## Task 5: Shared React hooks — `usePoll`, `useSealForm`, `useProofFlow`

**Files:**
- Create: `frontend/hooks/usePoll.ts`
- Create: `frontend/hooks/useSealForm.ts`
- Create: `frontend/hooks/useProofFlow.ts`

**Interfaces:**
- `usePoll(fn, intervalMs, deps)` → void
- `useSealForm()` → `{ state fields..., handleFileChange, handleSeal }`
- `useProofFlow(capsuleId)` → `{ state fields..., handleReveal, handleDecryptRecipient, handleMintNft, handleCopy }`

**Why:** `ProofClient.tsx` has 9 useState + 5 identical try-catch blocks. `seal/page.tsx` has 11 useState. Both have a polling pattern duplicated from `gallery/page.tsx`. Extracting hooks reduces components to pure render.

- [ ] **Step 1: Create `hooks/usePoll.ts`**

```typescript
// frontend/hooks/usePoll.ts
import { useEffect, useRef } from "react";

/**
 * Repeatedly calls `fn` every `intervalMs` ms until the component unmounts.
 * Restarts whenever `deps` change (like useEffect).
 */
export function usePoll(
  fn:          () => Promise<void>,
  intervalMs:  number,
  deps:        unknown[]
): void {
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    const run = async () => {
      while (!cancelled.current) {
        try { await fn(); } catch { /* caller handles errors via state */ }
        await new Promise<void>(resolve => setTimeout(resolve, intervalMs));
      }
    };

    run();
    return () => { cancelled.current = true; };
    // deps intentionally spread — caller controls restart semantics
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
```

- [ ] **Step 2: Create `hooks/useSealForm.ts`**

Read `frontend/app/seal/page.tsx` first to find all useState fields and `handleSeal`. Then create:

```typescript
// frontend/hooks/useSealForm.ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient } from "wagmi";
import { sealCapsule } from "@/lib/capsule";
import { formatError } from "@/lib/utils";
import { TriggerType } from "@/lib/types";
import type { TriggerConfig } from "@/lib/types";

const MAX_FILE_MB = 50;

export type ContentMode = "text" | "file";

export interface SealFormState {
  contentMode:     ContentMode;
  message:         string;
  fileDataUri:     string;
  fileName:        string;
  minutesFromNow:  number;
  trigger:         TriggerConfig;
  triggerContract: `0x${string}` | undefined;
  msSignersRaw:    string;   // comma/newline-separated addresses (raw textarea input)
  msThreshold:     number;
  loading:         boolean;
  status:          string;
  result:          { capsuleId: `0x${string}`; storageRoot: `0x${string}`; commitHash: `0x${string}`; drandRound: number; txHash: `0x${string}` } | null;
  sealed:          boolean;
  error:           string;
}

export function useSealForm() {
  const router    = useRouter();
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();

  const [contentMode,     setContentMode]     = useState<ContentMode>("text");
  const [message,         setMessage]         = useState("");
  const [fileDataUri,     setFileDataUri]      = useState("");
  const [fileName,        setFileName]         = useState("");
  const [minutesFromNow,  setMinutesFromNow]  = useState(60);
  const [trigger,         setTrigger]         = useState<TriggerConfig>({ type: TriggerType.TIME });
  const [triggerContract, setTriggerContract] = useState<`0x${string}` | undefined>(undefined);
  const [msSignersRaw,    setMsSignersRaw]    = useState("");
  const [msThreshold,     setMsThreshold]     = useState(2);
  const [loading,         setLoading]         = useState(false);
  const [status,          setStatus]          = useState("");
  const [result,          setResult]          = useState<SealFormState["result"]>(null);
  const [sealed,          setSealed]          = useState(false);
  const [error,           setError]           = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_MB} MB limit`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUri(reader.result as string);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleSeal() {
    const plaintext = contentMode === "text" ? message : fileDataUri;
    if (!plaintext.trim()) { setError("Content cannot be empty"); return; }
    if (!isConnected || !walletClient) { setError("Connect your wallet first"); return; }

    // Validate multisig signer list before submitting
    if (trigger.type === TriggerType.MULTISIG) {
      const signers = msSignersRaw
        .split(/[\s,]+/)
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];
      if (signers.length < msThreshold) {
        setError(`Need at least ${msThreshold} valid signer address(es)`);
        return;
      }
      // Normalize trigger to include parsed signers
      setTrigger({ type: TriggerType.MULTISIG, signers, threshold: msThreshold });
    }

    setLoading(true);
    setError("");
    setStatus("Preparing…");
    try {
      const unlockTime = new Date(Date.now() + minutesFromNow * 60_000);
      const res = await sealCapsule({
        plaintext,
        unlockTime,
        signer:          walletClient as Parameters<typeof sealCapsule>[0]["signer"],
        trigger,
        triggerContract,
      });
      setResult(res);
      setSealed(true);
      setStatus("Sealed!");
      setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1500);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    // state
    contentMode, message, fileDataUri, fileName,
    minutesFromNow, trigger, triggerContract,
    msSignersRaw, msThreshold,
    loading, status, result, sealed, error,
    // setters
    setContentMode, setMessage, setMinutesFromNow,
    setTrigger, setTriggerContract,
    setMsSignersRaw, setMsThreshold,
    // handlers
    handleFileChange, handleSeal,
    // constants
    MAX_FILE_MB,
    isConnected,
  };
}
```

- [ ] **Step 3: Create `hooks/useProofFlow.ts`**

Read `frontend/app/proof/[id]/ProofClient.tsx` to find all useState and handler logic. Then create:

```typescript
// frontend/hooks/useProofFlow.ts
"use client";

import { useState, useCallback } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { revealCapsule, decryptAsRecipient, decryptRevealed } from "@/lib/capsule";
import { mintCapsuleNFT } from "@/lib/nft";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { formatError } from "@/lib/utils";
import type { OnChainCapsule, RevealResult } from "@/lib/types";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

export function useProofFlow(capsuleId: `0x${string}`) {
  const { data: walletClient }  = useWalletClient();
  const { address, isConnected } = useAccount();

  const [capsule,     setCapsule]     = useState<OnChainCapsule | null>(null);
  const [unlocked,    setUnlocked]    = useState(false);
  const [result,      setResult]      = useState<RevealResult | null>(null);
  const [status,      setStatus]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [copied,      setCopied]      = useState(false);
  const [nftTokenId,  setNftTokenId]  = useState<bigint | null>(null);
  const [nftLoading,  setNftLoading]  = useState(false);

  /** Called by usePoll — refreshes capsule state silently. */
  const pollCapsule = useCallback(async () => {
    const cap = await getCapsule(capsuleId);
    setCapsule(cap);
    setUnlocked(await isUnlocked(capsuleId));
  }, [capsuleId]);

  async function withLoadingGuard<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setLoading(true);
    setError("");
    setStatus(label);
    try {
      return await fn();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal() {
    if (!walletClient) return;
    await withLoadingGuard("Revealing…", async () => {
      const res = await revealCapsule(capsuleId, walletClient as Parameters<typeof revealCapsule>[1]);
      setResult(res);
      setStatus("Revealed!");
    });
  }

  async function handleDecryptRecipient(privKey: Uint8Array) {
    if (!address) return;
    await withLoadingGuard("Decrypting…", async () => {
      const res = await decryptAsRecipient(capsuleId, address, privKey);
      setResult(res);
      setStatus("Decrypted!");
    });
  }

  async function handleDecryptRevealed() {
    if (!walletClient) return;
    await withLoadingGuard("Decrypting…", async () => {
      const res = await decryptRevealed(capsuleId, walletClient as Parameters<typeof decryptRevealed>[1]);
      setResult(res);
    });
  }

  async function handleMintNft() {
    if (CONTRACT_ADDRESSES.CapsuleNFT === "0x") return;
    setNftLoading(true);
    setError("");
    try {
      const tokenId = await mintCapsuleNFT(capsuleId);
      setNftTokenId(tokenId);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setNftLoading(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return {
    // state
    capsule, unlocked, result, status, loading, error,
    copied, nftTokenId, nftLoading,
    address, isConnected,
    // actions
    pollCapsule, handleReveal, handleDecryptRecipient,
    handleDecryptRevealed, handleMintNft, handleCopy,
  };
}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | grep "hooks"
```
Expected: no errors in new hook files.

- [ ] **Step 5: Commit**

```bash
git add frontend/hooks/
git commit -m "feat(hooks): usePoll, useSealForm, useProofFlow extracted from page components"
```

---

## Task 6: Update `app/seal/page.tsx` to use `useSealForm`

**Files:**
- Modify: `frontend/app/seal/page.tsx`

**Why:** `seal/page.tsx` currently manages 11 useState slices and contains all form validation and seal orchestration inline across ~427 lines. After this task the component is pure render (~200 lines).

- [ ] **Step 1: Replace the state + handler block at the top of the component with the hook**

Remove all `useState` declarations and `handleSeal`/`handleFileChange` definitions from the component body.

Add import at top of file:
```typescript
import { useSealForm } from "@/hooks/useSealForm";
import type { TriggerConfig } from "@/lib/types";
```

Replace the block of `useState` calls with:
```typescript
const {
  contentMode, message, fileDataUri, fileName,
  minutesFromNow, trigger, triggerContract,
  msSignersRaw, msThreshold,
  loading, status, result, sealed, error,
  setContentMode, setMessage, setMinutesFromNow,
  setTrigger, setTriggerContract,
  setMsSignersRaw, setMsThreshold,
  handleFileChange, handleSeal,
  MAX_FILE_MB, isConnected,
} = useSealForm();
```

- [ ] **Step 2: Update trigger selector UI to use `trigger.type` instead of `triggerType`**

Replace:
```typescript
triggerType === TriggerType.DEADMAN
```
with:
```typescript
trigger.type === TriggerType.DEADMAN
```

Replace:
```typescript
triggerType === TriggerType.MULTISIG
```
with:
```typescript
trigger.type === TriggerType.MULTISIG
```

For the trigger-select button `onClick`:
```typescript
// OLD:
onClick={() => setTriggerType(opt.value)}

// NEW — build a typed TriggerConfig when switching trigger type:
onClick={() => {
  if (opt.value === TriggerType.DEADMAN)
    setTrigger({ type: TriggerType.DEADMAN, intervalDays: 30 });
  else if (opt.value === TriggerType.MULTISIG)
    setTrigger({ type: TriggerType.MULTISIG, signers: [], threshold: 2 });
  else
    setTrigger({ type: TriggerType.TIME });
}}
```

For the deadman interval input `onChange`:
```typescript
// Trigger is TriggerConfig with type DEADMAN at this point
onChange={e => setTrigger({ type: TriggerType.DEADMAN, intervalDays: Number(e.target.value) })}
```

- [ ] **Step 3: Remove now-unused imports from `seal/page.tsx`**

Remove any imports that were only used by the extracted hook logic (e.g., `useRouter`, `useAccount`, `useWalletClient`, `sealCapsule`, `TriggerType` if no longer used directly, etc.). Keep only imports needed for the render JSX.

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | grep "seal"
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/seal/page.tsx
git commit -m "refactor(seal): extract useSealForm hook, component is now pure render"
```

---

## Task 7: Update `app/proof/[id]/ProofClient.tsx` to use `useProofFlow` + `usePoll`

**Files:**
- Modify: `frontend/app/proof/[id]/ProofClient.tsx`

**Why:** 9 useState + 5 identical try-catch blocks. After this task the component is pure render + `usePoll` wiring.

- [ ] **Step 1: Add imports**

Add to imports:
```typescript
import { useProofFlow } from "@/hooks/useProofFlow";
import { usePoll } from "@/hooks/usePoll";
```

- [ ] **Step 2: Replace all useState + handler definitions with the hook**

Remove all existing `useState` calls (`capsule`, `unlocked`, `result`, `status`, `loading`, `error`, `copied`, `nftTokenId`, `nftLoading`) and their handler functions (`handleReveal`, `handleDecryptRecipient`, `handleDecryptRevealed`, `handleMintNft`, `handleCopy`).

Replace with:
```typescript
const {
  capsule, unlocked, result, status, loading, error,
  copied, nftTokenId, nftLoading,
  address, isConnected,
  pollCapsule, handleReveal, handleDecryptRecipient,
  handleDecryptRevealed, handleMintNft, handleCopy,
} = useProofFlow(capsuleId);
```

- [ ] **Step 3: Replace the `useEffect` polling block with `usePoll`**

Remove the existing `useEffect` that sets up polling (the one with `cancelled`, `setInterval`, and cleanup). Replace with:

```typescript
usePoll(pollCapsule, 5_000, [capsuleId]);
```

- [ ] **Step 4: Remove now-unused imports**

Remove direct imports of `getCapsule`, `isUnlocked`, `revealCapsule`, `decryptAsRecipient`, `decryptRevealed`, `mintCapsuleNFT`, and any useState/useEffect/useCallback that is no longer used directly.

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep "error TS" | grep -i "proof"
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/proof/
git commit -m "refactor(proof): use useProofFlow + usePoll hooks, remove 5x duplicated try-catch"
```

---

## Task 8: API route hardening — `download/route.ts` + `upload/route.ts`

**Files:**
- Modify: `frontend/app/api/storage/download/route.ts`
- Modify: `frontend/app/api/storage/upload/route.ts`

**Why:**
1. Download route loads entire file into memory with no size cap — 50 MB file → 100+ MB allocated
2. `hash.startsWith("0x") ? hash.slice(2) : hash` is duplicated in both routes and in `lib/storage.ts`

- [ ] **Step 1: Add `normalizeHash` import to download route**

At the top of `frontend/app/api/storage/download/route.ts`, add:
```typescript
import { normalizeHash } from "@/lib/utils";
```

- [ ] **Step 2: Replace inline hex stripping with `normalizeHash`**

In `download/route.ts`, replace:
```typescript
const bareHash = hash.startsWith("0x") ? hash.slice(2) : hash;
```
with:
```typescript
const bareHash = normalizeHash(hash);
```

- [ ] **Step 3: Add file size guard before reading into memory**

After the `existsSync` check and before `readFileSync`, add:

```typescript
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const { size } = statSync(tmpPath);
if (size > MAX_DOWNLOAD_BYTES) {
  unlinkSync(tmpPath);
  return NextResponse.json(
    { error: "Downloaded file exceeds 50 MB limit" },
    { status: 413 }
  );
}
```

Also add `statSync` and `unlinkSync` to the `fs` import:
```typescript
import { existsSync, readFileSync, unlinkSync, statSync } from "fs";
```

- [ ] **Step 4: Apply `normalizeHash` in `upload/route.ts`**

Add import:
```typescript
import { normalizeHash } from "@/lib/utils";
```

Replace:
```typescript
const hexHash = rawHash.startsWith("0x") ? rawHash : `0x${rawHash}`;
```
with:
```typescript
const hexHash = rawHash.startsWith("0x") ? rawHash : `0x${normalizeHash(rawHash)}`;
```
(or just use `0x${normalizeHash(rawHash)}` unconditionally since normalizeHash strips the prefix and then we re-add it.)

Actually simpler — replace with:
```typescript
const hexHash: `0x${string}` = `0x${normalizeHash(rawHash)}`;
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: **zero errors across all files**.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/storage/
git commit -m "fix(api): add 50MB download size guard, use normalizeHash utility in both routes"
```

---

## Verification

After all 8 tasks are complete, verify the full refactor:

1. **Zero typecheck errors:**
   ```bash
   cd frontend && npm run typecheck
   ```

2. **Dev server starts cleanly:**
   ```bash
   cd frontend && npm run dev
   ```
   Open http://localhost:3000. Check for console errors.

3. **Seal flow works:** Connect wallet → go to `/seal` → set a message + time trigger → click Seal. Verify redirect to `/proof/<id>`.

4. **Proof page polls:** Visit `/proof/<id>`. Verify capsule state loads and shows correctly.

5. **Discriminated union enforced:** In `lib/types.ts`, try manually writing `trigger: { type: TriggerType.DEADMAN }` without `intervalDays` — TypeScript should error.

6. **Git log:**
   ```bash
   git log --oneline -8
   ```
   Expected: 8 commits, one per task.
