/**
 * Time Capsule hybrid encryption — v2 (tlock) + v1 backward-compat.
 *
 * Trust model (v2):
 *   - Content is AES-256-GCM encrypted with a random dataKey.
 *   - dataKey is tlock-encrypted to the drand quicknet round for unlockTime.
 *   - Until that round is published the header yields nothing — no key is derivable
 *     by anyone, including the server and the owner, before unlock time.
 *   - The contract enforces reveal access control (time / trigger).
 *   - commitHash = keccak256(plaintext) proves tamper-evidence at any time.
 *
 * Trust model (v1, legacy — headers exactly 100 bytes):
 *   - dataKey wrapped under HKDF(capsuleSeed, drandRound) — deterministic from
 *     the public timelockHeader. No cryptographic confidentiality pre-unlock.
 *   - Retained for backward-compatibility with capsules sealed before this change.
 *
 * timelockHeader v2 layout (variable length, always > 100 bytes):
 *   [0]      0x02 (version byte)
 *   [1..8]   drandRound (8 bytes, big-endian uint64)
 *   [9..]    tlock AGE ciphertext (UTF-8 text, rest of blob)
 *
 * timelockHeader v1 layout (exactly 100 bytes):
 *   [0..31]  capsuleSeed (32 bytes, random)
 *   [32..39] drandRound  (8 bytes, big-endian uint64)
 *   [40..51] nonce2      (12 bytes)
 *   [52..99] wrappedKey  (48 bytes = 32-byte key + 16-byte GCM auth tag)
 */

import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { utf8ToBytes, bytesToUtf8, concatBytes } from "@noble/ciphers/utils";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { keccak_256 } from "@noble/hashes/sha3";
import { timelockEncrypt, timelockDecrypt } from "tlock-js";
import type { ChainClient } from "drand-client";
import { getOrCreateDrandClient } from "./drand";

export const NONCE_LEN = 12;
const SEED_LEN         = 32;
const ROUND_LEN        = 8;
const HEADER_V1_LEN    = 100;
const HEADER_V2_VERSION = 0x02;

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

// ── v1 header encode / decode (retained for backward-compat) ──────────────────

interface HeaderV1 {
  capsuleSeed: Uint8Array;
  drandRound:  number;
  nonce2:      Uint8Array;
  wrappedKey:  Uint8Array;
}

function decodeV1Header(raw: Uint8Array): HeaderV1 {
  let o = 0;
  const capsuleSeed = raw.slice(o, o += SEED_LEN);
  const drandRound  = Number(new DataView(raw.buffer, raw.byteOffset + o, ROUND_LEN).getBigUint64(0, false));
  o += ROUND_LEN;
  const nonce2     = raw.slice(o, o += NONCE_LEN);
  const wrappedKey = raw.slice(o);
  return { capsuleSeed, drandRound, nonce2, wrappedKey };
}

function _decryptV1(header: Uint8Array): Uint8Array {
  const { capsuleSeed, drandRound, nonce2, wrappedKey } = decodeV1Header(header);
  const wrapKey = hkdf(sha256, capsuleSeed, u64BE(drandRound), utf8ToBytes("0g-time-capsule-v1"), 32);
  return aesDecrypt(wrappedKey, wrapKey, nonce2);
}

// ── Seal (v2) ─────────────────────────────────────────────────────────────────

/**
 * Encrypt plaintext and return everything needed for TimeCapsule.seal().
 *
 * Uses drand tlock to encrypt the dataKey to `drandRound`: the key is
 * mathematically undecryptable until the beacon for that round is published
 * (i.e., until unlockTime has passed on the drand network).
 *
 * @param chainClient  Optional — injected so callers can reuse the probed client.
 *                     Defaults to getOrCreateDrandClient() if omitted.
 */
export async function encryptForSeal(
  plaintext:   string,
  drandRound:  number,
  chainClient?: ChainClient,
): Promise<{
  packed:         Uint8Array;
  timelockHeader: Uint8Array;
  commitHash:     `0x${string}`;
  dataKey:        Uint8Array;
}> {
  const dataKey = randomBytes(32);

  // AES-256-GCM encrypt plaintext
  const { nonce: nonce1, ct } = aesEncrypt(utf8ToBytes(plaintext), dataKey);
  const packed = concatBytes(nonce1, ct);

  // tlock-encrypt dataKey to the drand round — undecryptable before beacon published
  // `as any` works around a tlock-js@0.9.0 type declaration mismatch with TS5
  // (the d.ts swaps string/Buffer vs what TypeScript infers; runtime is correct)
  const client  = chainClient ?? await getOrCreateDrandClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tlockCt = await (timelockEncrypt as any)(drandRound, Buffer.from(dataKey), client) as string;

  // v2 header: [0x02][8-byte round][tlock ciphertext UTF-8]
  const timelockHeader = concatBytes(
    new Uint8Array([HEADER_V2_VERSION]),
    u64BE(drandRound),
    utf8ToBytes(tlockCt),
  );

  return { packed, timelockHeader, commitHash: makeCommitHash(plaintext), dataKey };
}

// ── Reveal ────────────────────────────────────────────────────────────────────

/**
 * Decrypt capsule payload after on-chain reveal.
 *
 * Handles both v2 (tlock) and v1 (HKDF legacy) headers transparently.
 * For v2, fetches the drand beacon to recover the dataKey — requires network
 * and the round to have been published (i.e., unlockTime has passed).
 *
 * @param chainClient  Optional — injected for testability. Defaults to
 *                     getOrCreateDrandClient() if omitted.
 */
export async function decryptFromReveal(
  packed:         Uint8Array,
  timelockHeader: Uint8Array,
  chainClient?:   ChainClient,
): Promise<string> {
  let dataKey: Uint8Array;

  if (timelockHeader.length === HEADER_V1_LEN) {
    // v1 legacy: HKDF-derived wrapKey (synchronous, no beacon fetch needed)
    dataKey = _decryptV1(timelockHeader);
  } else {
    // v2 tlock path
    if (timelockHeader[0] !== HEADER_V2_VERSION) {
      throw new Error(`Unknown timelockHeader version byte: 0x${timelockHeader[0].toString(16)}`);
    }
    const tlockCtBytes = timelockHeader.slice(1 + ROUND_LEN); // skip version + round
    const tlockCt      = bytesToUtf8(tlockCtBytes);
    const client  = chainClient ?? await getOrCreateDrandClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyBuf  = await (timelockDecrypt as any)(tlockCt, client) as Uint8Array;
    dataKey       = new Uint8Array(keyBuf);
  }

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
