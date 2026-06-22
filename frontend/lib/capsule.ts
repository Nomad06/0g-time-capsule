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

// ── Private decrypt helper ────────────────────────────────────────────────────

async function _decryptOwnerCapsule(
  capsuleId:      `0x${string}`,
  timelockHeader: Uint8Array,
  packed:         Uint8Array
): Promise<{ plaintext: string; commitHash: `0x${string}`; verified: boolean }> {
  const plaintext = await decryptFromReveal(packed, timelockHeader);
  const hash      = makeCommitHash(plaintext);
  const verified  = await verifyOnChain(capsuleId, hash);
  return { plaintext, commitHash: hash, verified };
}

// ── Seal ──────────────────────────────────────────────────────────────────────

export async function sealCapsule(params: SealParams): Promise<SealResult> {
  const { plaintext, unlockTime, recipients = [], trigger, triggerContract } = params;

  if (!plaintext.trim())       throw new Error("Plaintext cannot be empty");
  if (unlockTime <= new Date()) throw new Error("Unlock time must be in the future");
  if (trigger && trigger.type !== TriggerType.TIME) _validateTrigger(trigger);

  // 1 + 2. Compute drand round + encrypt
  const { packed, timelockHeader, commitHash, dataKey, drandRound } =
    await _buildEncryption(plaintext, unlockTime);

  // 3. Upload to 0G Storage
  const { rootHash: storageRoot } = await uploadToStorage(packed);

  // 4. Commit on-chain
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
    timelockHeader: `0x${Buffer.from(timelockHeader).toString("hex")}`,
    unlockTime:     unlockTimestamp,
    recipients:     recipientAddresses,
    triggerType,
    triggerContract: resolvedTriggerContract,
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
