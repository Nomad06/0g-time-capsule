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
  revealSignMessage,
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
} from "./contract";
import { armSwitch, createVault } from "./triggers";
import { roundForTime } from "./drand";
import { TriggerType } from "./types";
import type { SealParams, SealResult, RevealResult } from "./types";

// ── Seal ──────────────────────────────────────────────────────────────────────

export async function sealCapsule(params: SealParams): Promise<SealResult> {
  const { plaintext, unlockTime, recipients = [], triggerType = 0, triggerContract } = params;

  if (!plaintext.trim())       throw new Error("Plaintext cannot be empty");
  if (unlockTime <= new Date()) throw new Error("Unlock time must be in the future");

  // 1. Map unlock time → drand round
  const drandRound = await roundForTime(unlockTime);

  // 2. Encrypt — also returns raw dataKey for Stage 2 ECIES wrapping
  const { packed, timelockHeader, commitHash, dataKey } = encryptForSeal(plaintext, drandRound);

  // 3. Upload to 0G Storage
  const { rootHash: storageRoot } = await uploadToStorage(packed);

  // 4. Commit on-chain
  const recipientAddresses = recipients.map(r => r.address);
  const unlockTimestamp    = BigInt(Math.floor(unlockTime.getTime() / 1000));
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
  if (recipients.length > 0) {
    const encryptedKeys = recipients.map(r =>
      bytesToHex(eciesEncrypt(r.pubkey, dataKey))
    );
    await setRecipientKeys(capsuleId, recipientAddresses, encryptedKeys);
  }

  // 6. Stage 3: set up trigger module after seal
  if (triggerType === TriggerType.DEADMAN && params.deadman) {
    const [account] = await (await import("./contract")).getWalletClient().getAddresses();
    const intervalSec = BigInt(params.deadman.intervalDays * 86400);
    await armSwitch(capsuleId, account, intervalSec);
  }

  if (triggerType === TriggerType.MULTISIG && params.multisig) {
    const [account] = await (await import("./contract")).getWalletClient().getAddresses();
    await createVault(
      capsuleId,
      account,
      params.multisig.signers,
      params.multisig.threshold
    );
  }

  return { capsuleId, storageRoot, commitHash, drandRound, txHash };
}

// ── Reveal ────────────────────────────────────────────────────────────────────

export async function revealCapsule(
  capsuleId:   `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer:      any  // wagmi/ethers signer — signs the reveal message
): Promise<RevealResult> {
  // 1. Trigger on-chain reveal (fails if still locked)
  const { timelockHeader: headerHex } = await revealOnChain(capsuleId);

  // 2. Owner signs to authorize local decryption
  const message      = revealSignMessage(capsuleId);
  const signatureHex = await signer.signMessage(message) as string;

  // 3. Decrypt
  const timelockHeader = Buffer.from(headerHex.slice(2), "hex");

  // Need storageRoot to fetch from 0G
  const cap = await getCapsule(capsuleId);
  const packed = await downloadFromStorage(cap.storageRoot);

  const plaintext = decryptFromReveal(packed, timelockHeader, signatureHex);

  // 4. Verify proof-of-existence
  const hash     = makeCommitHash(plaintext);
  const verified = await verifyOnChain(capsuleId, hash);

  return { capsuleId, plaintext, commitHash: hash, verified };
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
  const { gcm } = await import("@noble/ciphers/aes");
  const NONCE_LEN = 12;
  const nonce1    = packed.slice(0, NONCE_LEN);
  const ct        = packed.slice(NONCE_LEN);
  const { bytesToUtf8 } = await import("@noble/ciphers/utils");
  const plaintext = bytesToUtf8(gcm(dataKey, nonce1).decrypt(ct));

  const hash     = makeCommitHash(plaintext);
  const verified = await verifyOnChain(capsuleId, hash);

  return { capsuleId, plaintext, commitHash: hash, verified };
}

/**
 * Read-only reveal for already-revealed capsules (state === REVEALED).
 * Re-signs to decrypt locally without sending a tx.
 */
export async function decryptRevealed(
  capsuleId: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer:    any
): Promise<RevealResult> {
  const cap = await getCapsule(capsuleId);
  if (cap.state !== 1) throw new Error("Capsule not yet revealed on-chain");

  const timelockHeader = Buffer.from(cap.timelockHeader.slice(2), "hex");
  const packed         = await downloadFromStorage(cap.storageRoot);
  const message        = revealSignMessage(capsuleId);
  const signatureHex   = await signer.signMessage(message) as string;
  const plaintext      = decryptFromReveal(packed, timelockHeader, signatureHex);
  const hash           = makeCommitHash(plaintext);
  const verified       = await verifyOnChain(capsuleId, hash);

  return { capsuleId, plaintext, commitHash: hash, verified };
}
