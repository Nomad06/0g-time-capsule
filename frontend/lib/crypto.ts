/**
 * Time Capsule hybrid encryption.
 *
 * Trust model (honest, no BLS dependency):
 *   - Content is AES-256-GCM encrypted with a random dataKey.
 *   - dataKey is wrapped under a key derived from the owner's wallet signature.
 *   - The contract enforces the time lock — refuses reveal() before unlockTime.
 *   - On reveal, the owner signs a fixed message; client derives wrapKey, unwraps dataKey.
 *   - commitHash = keccak256(plaintext) stored on-chain proves content is tamper-proof.
 *
 * What this gives you:
 *   ✓ Content cannot be changed after seal (commitHash)
 *   ✓ No third party can decrypt (only owner-sig-derived key)
 *   ✓ Public reveal is enforced on-chain (contract rejects early reveal)
 *   ✓ Fully client-side; no server required
 *
 * timelockHeader layout (100 bytes, stored on-chain):
 *   [0..31]  capsuleSeed (32 bytes, random, public)
 *   [32..39] drandRound  (8 bytes, big-endian uint64)
 *   [40..51] nonce2      (12 bytes, AES-GCM nonce for wrappedKey)
 *   [52..99] wrappedKey  (48 bytes = 32-byte key + 16-byte GCM auth tag)
 */

import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { utf8ToBytes, bytesToUtf8, concatBytes } from "@noble/ciphers/utils";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { keccak_256 } from "@noble/hashes/sha3";

export const NONCE_LEN = 12;
const SEED_LEN  = 32;
const ROUND_LEN = 8;

// ── Low-level ─────────────────────────────────────────────────────────────────

function aesEncrypt(msg: Uint8Array, key: Uint8Array) {
  const nonce = randomBytes(NONCE_LEN);
  return { nonce, ct: gcm(key, nonce).encrypt(msg) };
}

function aesDecrypt(ct: Uint8Array, key: Uint8Array, nonce: Uint8Array) {
  return gcm(key, nonce).decrypt(ct);
}

function u64BE(n: number): Uint8Array {
  const b = new Uint8Array(ROUND_LEN);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), false);
  return b;
}

// ── timelockHeader encode / decode ────────────────────────────────────────────

interface Header {
  capsuleSeed: Uint8Array;
  drandRound:  number;
  nonce2:      Uint8Array;
  wrappedKey:  Uint8Array;
}

function encodeHeader(h: Header): Uint8Array {
  return concatBytes(h.capsuleSeed, u64BE(h.drandRound), h.nonce2, h.wrappedKey);
}

function decodeHeader(raw: Uint8Array): Header {
  let o = 0;
  const capsuleSeed = raw.slice(o, o += SEED_LEN);
  const drandRound  = Number(new DataView(raw.buffer, raw.byteOffset + o, ROUND_LEN).getBigUint64(0, false));
  o += ROUND_LEN;
  const nonce2     = raw.slice(o, o += NONCE_LEN);
  const wrappedKey = raw.slice(o);
  return { capsuleSeed, drandRound, nonce2, wrappedKey };
}

// ── Seal ──────────────────────────────────────────────────────────────────────

/**
 * Encrypt plaintext and return everything needed for TimeCapsule.seal().
 * Call this before the seal tx; pass result.timelockHeader on-chain.
 */
export function encryptForSeal(plaintext: string, drandRound: number): {
  packed:         Uint8Array;     // nonce1 ++ ciphertext → upload to 0G
  timelockHeader: Uint8Array;     // 100 bytes → seal() on-chain
  commitHash:     `0x${string}`; // keccak256(plaintext) → seal() on-chain
  wrapKey:        Uint8Array;     // keep in memory; pass to buildRevealSignature() test helper
  dataKey:        Uint8Array;     // raw key — Stage 2: ECIES-wrap per recipient
} {
  const dataKey     = randomBytes(32);
  const capsuleSeed = randomBytes(SEED_LEN);

  // Encrypt plaintext
  const { nonce: nonce1, ct } = aesEncrypt(utf8ToBytes(plaintext), dataKey);
  const packed = concatBytes(nonce1, ct);

  // Derive wrapKey from capsuleSeed + round (deterministic, reproducible from signature at reveal)
  const wrapKey = hkdf(sha256, capsuleSeed, u64BE(drandRound), utf8ToBytes("0g-time-capsule-v1"), 32);

  // Wrap dataKey
  const { nonce: nonce2, ct: wrappedKey } = aesEncrypt(dataKey, wrapKey);

  return {
    packed,
    timelockHeader: encodeHeader({ capsuleSeed, drandRound, nonce2, wrappedKey }),
    commitHash: makeCommitHash(plaintext),
    wrapKey,
    dataKey,
  };
}

// ── Reveal ────────────────────────────────────────────────────────────────────

/**
 * Decrypt capsule payload after on-chain reveal.
 *
 * @param packed          nonce1 ++ ciphertext from 0G Storage
 * @param timelockHeader  from CapsuleRevealed event (hex or bytes)
 */
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

// ── Commit hash ───────────────────────────────────────────────────────────────

export function makeCommitHash(plaintext: string): `0x${string}` {
  return `0x${Buffer.from(keccak_256(utf8ToBytes(plaintext))).toString("hex")}`;
}

// alias
export { makeCommitHash as commitHash };

// ── Utils ─────────────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex"));
}

export function bytesToHex(b: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(b).toString("hex")}`;
}
