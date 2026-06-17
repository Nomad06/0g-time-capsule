/**
 * Orchestrates the full seal → store → reveal → decrypt lifecycle.
 *
 * Confidentiality model — PRIVATE, time-gated:
 *   The dataKey is recoverable only by combining (a) a recipient's ECIES private
 *   key with (b) the drand beacon for the unlock round. Neither alone suffices.
 *   The tlock-encrypted key blob is NEVER published in the clear on-chain — it is
 *   ECIES-wrapped per recipient (owner is always a recipient). A non-recipient
 *   wallet, the server, and the public chain see only opaque ciphertext.
 *
 * Seal flow:
 *   1. Compute drand round for unlock time
 *   2. AES-encrypt plaintext under a random dataKey; tlock-encrypt dataKey → keyBlob
 *   3. Upload ciphertext → 0G Storage
 *   4. Call TimeCapsule.seal() on-chain with an EMPTY timelockHeader (no public key)
 *   5. ECIES-wrap keyBlob for owner + each recipient → setRecipientKeys()
 *
 * Decrypt flow (owner or recipient):
 *   1. Fetch this wallet's ECIES envelope via getRecipientKey()
 *   2. ECIES-decrypt with the wallet's local private key → keyBlob
 *   3. timelock-decrypt keyBlob (fails until the drand round is published) → dataKey
 *   4. Fetch ciphertext from 0G → AES-decrypt → plaintext
 *   5. Verify commitHash on-chain
 */

import {
  encryptForSeal,
  decryptFromReveal,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
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
  getEncryptionKey,
  getWalletClient,
} from "./contract";
import { armSwitch, createVault } from "./triggers";
import { getOrCreateDrandClient, roundForTime } from "./drand";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { TriggerType } from "./types";
import type { SealParams, SealResult, RevealResult, TriggerConfig, RecipientParam } from "./types";

// ── Private stage helpers ─────────────────────────────────────────────────────

interface EncryptionResult {
  packed:         Uint8Array;
  timelockHeader: Uint8Array;
  commitHash:     `0x${string}`;
  dataKey:        Uint8Array;
  drandRound:     number;
}

async function _buildEncryption(
  plaintext:  string,
  unlockTime: Date
): Promise<EncryptionResult> {
  // Probe once, reuse client for both roundForTime and tlock encryption
  const client     = await getOrCreateDrandClient();
  const drandRound = await roundForTime(unlockTime);
  const { packed, timelockHeader, commitHash, dataKey } = await encryptForSeal(plaintext, drandRound, client);
  return { packed, timelockHeader, commitHash, dataKey, drandRound };
}

/**
 * Resolve recipient wallet addresses → RecipientParam[] by fetching each one's
 * registered ECIES public key from KeyRegistry. Throws if any recipient has not
 * registered a key (they must visit /register first), otherwise their envelope
 * could never be built and they'd be silently unable to decrypt.
 */
export async function resolveRecipients(
  addresses: `0x${string}`[]
): Promise<RecipientParam[]> {
  const out: RecipientParam[] = [];
  for (const address of addresses) {
    const pubHex = await getEncryptionKey(address);
    if (!pubHex || pubHex === "0x") {
      throw new Error(`Recipient ${address} has not registered an encryption key (must visit /register)`);
    }
    out.push({ address, pubkey: hexToBytes(pubHex) });
  }
  return out;
}

/**
 * ECIES-wrap the tlock key blob (NOT the bare dataKey) for each recipient and
 * deposit the envelopes on-chain. Wrapping the time-locked blob — rather than the
 * dataKey itself — is what binds decryption to BOTH the recipient's private key
 * and the drand round: an envelope yields only the blob, which is still useless
 * until the beacon publishes.
 */
async function _distributeRecipientKeys(
  capsuleId:  `0x${string}`,
  recipients: RecipientParam[],
  keyBlob:    Uint8Array
): Promise<void> {
  if (recipients.length === 0) return;
  const recipientAddresses = recipients.map(r => r.address);
  const encryptedKeys      = recipients.map(r => bytesToHex(eciesEncrypt(r.pubkey, keyBlob)));
  await setRecipientKeys(capsuleId, recipientAddresses, encryptedKeys);
}

/** Dedupe RecipientParams by address (case-insensitive), keeping first occurrence. */
function _dedupeRecipients(recipients: RecipientParam[]): RecipientParam[] {
  const seen = new Set<string>();
  const out: RecipientParam[] = [];
  for (const r of recipients) {
    const k = r.address.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Recover the tlock key blob for `address` by ECIES-decrypting its on-chain
 * envelope with the wallet's local private key. Throws if no envelope exists
 * (caller is not a provisioned recipient/owner of this capsule).
 */
async function _recoverKeyBlob(
  capsuleId: `0x${string}`,
  address:   `0x${string}`,
  privKey:   Uint8Array
): Promise<Uint8Array> {
  const envelopeHex = await getRecipientKey(capsuleId, address);
  if (!envelopeHex || envelopeHex === "0x") {
    throw new Error("This capsule is private — your address has no decryption key on it (not a recipient).");
  }
  return eciesDecrypt(privKey, hexToBytes(envelopeHex));
}

/**
 * Given a recovered key blob, fetch the ciphertext and decrypt. The timelock
 * decrypt inside decryptFromReveal fails until the drand round is published,
 * which enforces the time gate even for a valid recipient.
 */
async function _decryptWithKeyBlob(
  capsuleId: `0x${string}`,
  keyBlob:   Uint8Array
): Promise<RevealResult> {
  const cap       = await getCapsule(capsuleId);
  const packed    = await downloadFromStorage(cap.storageRoot);
  const plaintext = await decryptFromReveal(packed, keyBlob);
  const hash      = makeCommitHash(plaintext);
  const verified  = await verifyOnChain(capsuleId, hash);
  return { capsuleId, plaintext, commitHash: hash, verified };
}

/**
 * Validate trigger config before any on-chain action. Trigger setup runs *after*
 * seal(), so a config the trigger contract would reject (e.g. MULTISIG threshold >
 * signer count) must be caught here — otherwise the capsule is sealed with a
 * triggerContract pointing at a vault/switch that never gets created, leaving the
 * capsule permanently unrevealable.
 */
function _validateTrigger(trigger: TriggerConfig): void {
  if (trigger.type === TriggerType.DEADMAN) {
    if (trigger.intervalDays < 1) {
      throw new Error("Dead Man's Switch interval must be at least 1 day");
    }
  } else if (trigger.type === TriggerType.MULTISIG) {
    if (trigger.signers.length === 0) {
      throw new Error("Multi-sig requires at least one signer");
    }
    if (trigger.threshold < 1 || trigger.threshold > trigger.signers.length) {
      throw new Error(`Multi-sig threshold must be between 1 and ${trigger.signers.length}`);
    }
  }
}

async function _setupTrigger(
  capsuleId: `0x${string}`,
  trigger:   TriggerConfig
): Promise<void> {
  if (trigger.type === TriggerType.DEADMAN) {
    const { account } = await getWalletClient();
    if (!account) throw new Error("No wallet connected");
    const intervalSec = BigInt(trigger.intervalDays * 86400);
    await armSwitch(capsuleId, account.address, intervalSec);
  } else if (trigger.type === TriggerType.MULTISIG) {
    const { account } = await getWalletClient();
    if (!account) throw new Error("No wallet connected");
    await createVault(capsuleId, account.address, trigger.signers, trigger.threshold);
  }
}

// ── Seal ──────────────────────────────────────────────────────────────────────

export async function sealCapsule(params: SealParams): Promise<SealResult> {
  const { plaintext, unlockTime, recipients = [], trigger, triggerContract } = params;

  if (!plaintext.trim())       throw new Error("Plaintext cannot be empty");
  if (unlockTime <= new Date()) throw new Error("Unlock time must be in the future");
  if (trigger && trigger.type !== TriggerType.TIME) _validateTrigger(trigger);

  // 1 + 2. Compute drand round + encrypt. `timelockHeader` is the tlock key blob;
  // it stays off-chain (ECIES-wrapped per recipient) so the public never sees it.
  const { packed, timelockHeader: keyBlob, commitHash, drandRound } =
    await _buildEncryption(plaintext, unlockTime);

  // The owner is always a recipient — they must have a registered ECIES key so we
  // can wrap the blob for them, otherwise they could never read their own capsule.
  const { account } = await getWalletClient();
  const ownerAddress = account.address;
  const ownerKeyHex  = await getEncryptionKey(ownerAddress);
  if (!ownerKeyHex || ownerKeyHex === "0x") {
    throw new Error("Register an encryption key first (visit /register) — required to seal a private capsule.");
  }
  const allRecipients = _dedupeRecipients([
    { address: ownerAddress, pubkey: hexToBytes(ownerKeyHex) },
    ...recipients,
  ]);

  // 3. Upload to 0G Storage
  const { rootHash: storageRoot } = await uploadToStorage(packed);

  // 4. Commit on-chain. On-chain `recipients` stays the caller-supplied list (for
  // the recipient index / gallery); the owner is provisioned a key separately.
  const recipientAddresses = recipients.map(r => r.address);
  const unlockTimestamp    = BigInt(Math.floor(unlockTime.getTime() / 1000));
  const triggerType        = trigger?.type ?? TriggerType.TIME;

  // Wire the on-chain trigger contract so reveal() consults the switch/vault.
  // Without this, DEADMAN/MULTISIG capsules fall back to plain time-unlock,
  // silently bypassing the trigger. Explicit triggerContract param wins.
  const resolvedTriggerContract =
    triggerContract ??
    (triggerType === TriggerType.DEADMAN  ? CONTRACT_ADDRESSES.DeadManSwitch  :
     triggerType === TriggerType.MULTISIG ? CONTRACT_ADDRESSES.MultiSigReveal :
     undefined);

  const { txHash, capsuleId } = await sealOnChain({
    storageRoot,
    commitHash,
    timelockHeader: "0x",            // no public key blob — confidentiality lives in the envelopes
    unlockTime:     unlockTimestamp,
    recipients:     recipientAddresses,
    triggerType,
    triggerContract: resolvedTriggerContract,
  });

  // 5. Stage 2: ECIES-wrap the time-locked key blob for owner + each recipient
  await _distributeRecipientKeys(capsuleId, allRecipients, keyBlob);

  // 6. Stage 3: set up trigger module after seal
  if (trigger && trigger.type !== TriggerType.TIME) {
    await _setupTrigger(capsuleId, trigger);
  }

  return { capsuleId, storageRoot, commitHash, drandRound, txHash };
}

// ── Reveal ────────────────────────────────────────────────────────────────────

export async function revealCapsule(
  capsuleId: `0x${string}`,
  address:   `0x${string}`,
  privKey:   Uint8Array,
): Promise<RevealResult> {
  // On-chain record of the open (and fires any DEADMAN/MULTISIG trigger). Decryption
  // itself does NOT depend on this tx — it is gated client-side by the caller's
  // recipient key plus the drand round, so the reveal event leaks nothing.
  await revealOnChain(capsuleId);
  const keyBlob = await _recoverKeyBlob(capsuleId, address, privKey);
  return _decryptWithKeyBlob(capsuleId, keyBlob);
}

/**
 * Decrypt a capsule as the owner or a designated recipient, using the ECIES
 * private key held in this browser. No on-chain reveal tx required — the time
 * gate is enforced cryptographically by the drand round inside the key blob.
 *
 * @param capsuleId   Capsule to decrypt
 * @param address     The connected wallet (must have an envelope on this capsule)
 * @param privKey     This wallet's secp256k1 private key (loadPrivKeyFromStorage)
 */
export async function decryptAsRecipient(
  capsuleId: `0x${string}`,
  address:   `0x${string}`,
  privKey:   Uint8Array
): Promise<RevealResult> {
  const keyBlob = await _recoverKeyBlob(capsuleId, address, privKey);
  return _decryptWithKeyBlob(capsuleId, keyBlob);
}
