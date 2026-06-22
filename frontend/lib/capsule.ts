/**
 * Orchestrates the full seal → store → reveal → decrypt lifecycle.
 *
 * Seal flow:
 *   1. Compute drand round for unlock time
 *   2. AES-encrypt plaintext; wrap dataKey under signature-derived wrapKey
 *   3. Upload ciphertext → 0G Storage
 *   4. Call TimeCapsule.seal() on-chain → get capsuleId
 *
 * Reveal flow:
 *   1. Check capsule is unlocked (contract read)
 *   2. Call TimeCapsule.reveal() on-chain → emits timelockHeader
 *   3. Owner signs revealSignMessage(capsuleId) → wrapKey → dataKey
 *   4. Fetch ciphertext from 0G → AES-decrypt → plaintext
 *   5. Verify commitHash on-chain
 */

import {
  encryptForSeal,
  decryptFromReveal,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
  NONCE_LEN,
} from "./crypto";
import { gcm } from "@noble/ciphers/aes";
import { bytesToUtf8 } from "@noble/ciphers/utils";
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
  const drandRound = await roundForTime(unlockTime);
  const { packed, timelockHeader, commitHash, dataKey } = encryptForSeal(plaintext, drandRound);
  return { packed, timelockHeader, commitHash, dataKey, drandRound };
}

async function _distributeRecipientKeys(
  capsuleId:  `0x${string}`,
  recipients: RecipientParam[],
  dataKey:    Uint8Array
): Promise<void> {
  if (recipients.length === 0) return;
  const recipientAddresses = recipients.map(r => r.address);
  const encryptedKeys      = recipients.map(r => bytesToHex(eciesEncrypt(r.pubkey, dataKey)));
  await setRecipientKeys(capsuleId, recipientAddresses, encryptedKeys);
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

// ── Private decrypt helper ────────────────────────────────────────────────────

async function _decryptOwnerCapsule(
  capsuleId:      `0x${string}`,
  timelockHeader: Uint8Array,
  packed:         Uint8Array
): Promise<{ plaintext: string; commitHash: `0x${string}`; verified: boolean }> {
  const plaintext = decryptFromReveal(packed, timelockHeader);
  const hash      = makeCommitHash(plaintext);
  const verified  = await verifyOnChain(capsuleId, hash);
  return { plaintext, commitHash: hash, verified };
}

// ── Seal ──────────────────────────────────────────────────────────────────────

export async function sealCapsule(params: SealParams): Promise<SealResult> {
  const { plaintext, unlockTime, recipients = [], trigger, triggerContract } = params;

  if (!plaintext.trim())       throw new Error("Plaintext cannot be empty");
  if (unlockTime <= new Date()) throw new Error("Unlock time must be in the future");

  // 1 + 2. Compute drand round + encrypt
  const { packed, timelockHeader, commitHash, dataKey, drandRound } =
    await _buildEncryption(plaintext, unlockTime);

  // 3. Upload to 0G Storage
  const { rootHash: storageRoot } = await uploadToStorage(packed);

  // 4. Commit on-chain
  const recipientAddresses = recipients.map(r => r.address);
  const unlockTimestamp    = BigInt(Math.floor(unlockTime.getTime() / 1000));
  const triggerType        = trigger?.type ?? TriggerType.TIME;

  const { txHash, capsuleId } = await sealOnChain({
    storageRoot,
    commitHash,
    timelockHeader: `0x${Buffer.from(timelockHeader).toString("hex")}`,
    unlockTime:     unlockTimestamp,
    recipients:     recipientAddresses,
    triggerType,
    triggerContract,
  });

  // 5. Stage 2: deposit ECIES-encrypted dataKey per recipient
  await _distributeRecipientKeys(capsuleId, recipients, dataKey);

  // 6. Stage 3: set up trigger module after seal
  if (trigger && trigger.type !== TriggerType.TIME) {
    await _setupTrigger(capsuleId, trigger);
  }

  return { capsuleId, storageRoot, commitHash, drandRound, txHash };
}

// ── Reveal ────────────────────────────────────────────────────────────────────

export async function revealCapsule(
  capsuleId: `0x${string}`
): Promise<RevealResult> {
  const { timelockHeader: headerHex } = await revealOnChain(capsuleId);
  const timelockHeader = Buffer.from(headerHex.slice(2), "hex");

  const cap    = await getCapsule(capsuleId);
  const packed = await downloadFromStorage(cap.storageRoot);

  const { plaintext, commitHash, verified } =
    await _decryptOwnerCapsule(capsuleId, timelockHeader, packed);

  return { capsuleId, plaintext, commitHash, verified };
}

/**
 * Stage 2: Decrypt a capsule as a designated recipient using their stored ECIES private key.
 * The capsule must already be revealed on-chain.
 *
 * @param capsuleId   Capsule to decrypt
 * @param privKey     Recipient's secp256k1 private key (from localStorage via loadPrivKeyFromStorage)
 */
export async function decryptAsRecipient(
  capsuleId: `0x${string}`,
  address:   `0x${string}`,
  privKey:   Uint8Array
): Promise<RevealResult> {
  const cap = await getCapsule(capsuleId);
  if (cap.state !== 1) throw new Error("Capsule not yet revealed on-chain");

  // Fetch the ECIES-encrypted envelope for this recipient
  const envelopeHex = await getRecipientKey(capsuleId, address);
  if (!envelopeHex || envelopeHex === "0x") {
    throw new Error("No encrypted key found for your address on this capsule");
  }

  const envelope = hexToBytes(envelopeHex);
  const dataKey  = eciesDecrypt(privKey, envelope);

  const packed   = await downloadFromStorage(cap.storageRoot);

  // AES-decrypt with the ECIES-recovered dataKey
  const nonce1    = packed.slice(0, NONCE_LEN);
  const ct        = packed.slice(NONCE_LEN);
  const plaintext = bytesToUtf8(gcm(dataKey, nonce1).decrypt(ct));

  const hash     = makeCommitHash(plaintext);
  const verified = await verifyOnChain(capsuleId, hash);

  return { capsuleId, plaintext, commitHash: hash, verified };
}

/**
 * Read-only decrypt for already-revealed capsules (state === REVEALED).
 * No tx or signature required.
 */
export async function decryptRevealed(
  capsuleId: `0x${string}`
): Promise<RevealResult> {
  const cap = await getCapsule(capsuleId);
  if (cap.state !== 1) throw new Error("Capsule not yet revealed on-chain");

  const timelockHeader = Buffer.from(cap.timelockHeader.slice(2), "hex");
  const packed         = await downloadFromStorage(cap.storageRoot);

  const { plaintext, commitHash, verified } =
    await _decryptOwnerCapsule(capsuleId, timelockHeader, packed);

  return { capsuleId, plaintext, commitHash, verified };
}
