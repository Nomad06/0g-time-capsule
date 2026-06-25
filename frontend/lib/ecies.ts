/**
 * Minimal ECIES over secp256k1 for per-recipient dataKey encryption.
 *
 * Envelope layout (93 bytes for a 32-byte message):
 *   [0..32]   epkPub    — 33-byte compressed ephemeral public key
 *   [33..44]  nonce     — 12-byte AES-GCM nonce
 *   [45..]    ct        — AES-GCM ciphertext (message.length + 16 auth tag)
 *
 * For a 32-byte dataKey: envelope = 33 + 12 + 32 + 16 = 93 bytes
 *
 * Key agreement: ECDH(epkPriv, recipientPub) → sharedPoint (33 bytes, compressed)
 * KDF: HKDF-SHA256(ikm=sharedPoint, salt=epkPub, info="0g-capsule-ecies-v1")
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { gcm }        from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { concatBytes, utf8ToBytes } from "@noble/ciphers/utils";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

const INFO = utf8ToBytes("0g-capsule-ecies-v1");
const NONCE_LEN  = 12;
const EPK_LEN    = 33; // compressed

function deriveKey(sharedPoint: Uint8Array, epkPub: Uint8Array): Uint8Array {
  return hkdf(sha256, sharedPoint, epkPub, INFO, 32);
}

/**
 * Encrypt `message` (typically 32-byte dataKey) for `recipientPubKey`.
 * `recipientPubKey` is a 33-byte compressed secp256k1 public key from KeyRegistry.
 */
export function eciesEncrypt(recipientPubKey: Uint8Array, message: Uint8Array): Uint8Array {
  const epkPriv = secp256k1.utils.randomPrivateKey();
  const epkPub  = secp256k1.getPublicKey(epkPriv, true);           // 33 bytes

  const sharedPoint = secp256k1.getSharedSecret(epkPriv, recipientPubKey, true); // 33 bytes
  const encKey      = deriveKey(sharedPoint, epkPub);

  const nonce = randomBytes(NONCE_LEN);
  const ct    = gcm(encKey, nonce).encrypt(message);

  return concatBytes(epkPub, nonce, ct);
}

/**
 * Decrypt an envelope created by eciesEncrypt().
 * `privKey` is the 32-byte secp256k1 private key stored in the recipient's browser.
 */
export function eciesDecrypt(privKey: Uint8Array, envelope: Uint8Array): Uint8Array {
  let o = 0;
  const epkPub = envelope.slice(o, o += EPK_LEN);
  const nonce  = envelope.slice(o, o += NONCE_LEN);
  const ct     = envelope.slice(o);

  const sharedPoint = secp256k1.getSharedSecret(privKey, epkPub, true);
  const encKey      = deriveKey(sharedPoint, epkPub);

  return gcm(encKey, nonce).decrypt(ct);
}

/**
 * Generate a new secp256k1 keypair for use as an encryption identity.
 * Store privKey in localStorage; register pubKey on-chain via KeyRegistry.
 */
export function generateEncryptionKeypair(): { privKey: Uint8Array; pubKey: Uint8Array } {
  const privKey = secp256k1.utils.randomPrivateKey();
  const pubKey  = secp256k1.getPublicKey(privKey, true);
  return { privKey, pubKey };
}

// Message the user signs to derive their encryption identity. Stable forever —
// changing it would derive a different key and orphan existing capsules.
export const KEY_DERIVATION_MESSAGE =
  "0G Time Capsule\n\n" +
  "Sign to create your encryption key. This key lets you decrypt capsules " +
  "sealed for you, and is the same on every device.\n\n" +
  "This request is free and will not send a transaction.";

/**
 * Derive a deterministic secp256k1 keypair from a wallet signature.
 *
 * The signature over KEY_DERIVATION_MESSAGE is deterministic for a given wallet
 * (personal_sign / EIP-191), so the same user re-derives the *same* encryption
 * key on any device — no manual backup, no loss on cache-clear. We HKDF the
 * signature into a scalar, bumping a counter on the astronomically rare chance
 * the candidate is outside the valid secp256k1 range.
 */
export function deriveKeypairFromSignature(signature: Uint8Array): { privKey: Uint8Array; pubKey: Uint8Array } {
  for (let counter = 0; ; counter++) {
    const salt = utf8ToBytes(`0g-capsule-key-v1:${counter}`);
    const candidate = hkdf(sha256, signature, salt, utf8ToBytes("0g-capsule-identity"), 32);
    if (secp256k1.utils.isValidPrivateKey(candidate)) {
      return { privKey: candidate, pubKey: secp256k1.getPublicKey(candidate, true) };
    }
  }
}

// ── localStorage key management ───────────────────────────────────────────────

const LS_PREFIX = "0g-capsule-enckey-";

export function savePrivKeyToStorage(address: string, privKey: Uint8Array): void {
  localStorage.setItem(LS_PREFIX + address.toLowerCase(), Buffer.from(privKey).toString("hex"));
}

export function loadPrivKeyFromStorage(address: string): Uint8Array | null {
  const hex = localStorage.getItem(LS_PREFIX + address.toLowerCase());
  if (!hex) return null;
  return new Uint8Array(Buffer.from(hex, "hex"));
}

export function hasSavedPrivKey(address: string): boolean {
  return !!localStorage.getItem(LS_PREFIX + address.toLowerCase());
}
