/**
 * Encryption-identity orchestration.
 *
 * The ECIES identity key is derived deterministically from a wallet signature
 * (see deriveKeypairFromSignature) and cached in localStorage so we only prompt
 * to sign once per device. Because derivation is deterministic, a user who
 * clears their cache or logs in on a new device re-derives the *same* key by
 * signing again — replacing the old localStorage-only model where losing the
 * browser meant losing the ability to decrypt forever.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { getWalletClient } from "./contract";
import { hexToBytes } from "./crypto";
import {
  KEY_DERIVATION_MESSAGE,
  deriveKeypairFromSignature,
  loadPrivKeyFromStorage,
  savePrivKeyToStorage,
} from "./ecies";

export interface IdentityKey {
  privKey: Uint8Array;
  pubKey: Uint8Array;
  /** true when the key was freshly derived this call (i.e. user just signed). */
  created: boolean;
}

/**
 * Return the wallet's encryption keypair, deriving + caching it on first use.
 * Prompts a (gasless) signature only when nothing is cached for `address`.
 */
export async function getOrCreateIdentityKey(address: string): Promise<IdentityKey> {
  const cached = loadPrivKeyFromStorage(address);
  if (cached) {
    return { privKey: cached, pubKey: secp256k1.getPublicKey(cached, true), created: false };
  }

  const wallet = await getWalletClient();
  const sigHex = await wallet.signMessage({
    account: wallet.account,
    message: KEY_DERIVATION_MESSAGE,
  });
  const { privKey, pubKey } = deriveKeypairFromSignature(hexToBytes(sigHex));
  savePrivKeyToStorage(address, privKey);
  return { privKey, pubKey, created: true };
}
