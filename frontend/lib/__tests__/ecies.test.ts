import { describe, it, expect } from "vitest";
import {
  eciesEncrypt,
  eciesDecrypt,
  generateEncryptionKeypair,
  deriveKeypairFromSignature,
  savePrivKeyToStorage,
  loadPrivKeyFromStorage,
  hasSavedPrivKey,
} from "../ecies";
import { secp256k1 } from "@noble/curves/secp256k1";

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

describe("deriveKeypairFromSignature (deterministic identity)", () => {
  const sigA = new Uint8Array(65).fill(0x11);
  const sigB = new Uint8Array(65).fill(0x22);

  it("same signature → same keypair", () => {
    const k1 = deriveKeypairFromSignature(sigA);
    const k2 = deriveKeypairFromSignature(sigA);
    expect(Buffer.from(k1.privKey).toString("hex")).toBe(Buffer.from(k2.privKey).toString("hex"));
    expect(Buffer.from(k1.pubKey).toString("hex")).toBe(Buffer.from(k2.pubKey).toString("hex"));
  });

  it("different signatures → different keys", () => {
    const k1 = deriveKeypairFromSignature(sigA);
    const k2 = deriveKeypairFromSignature(sigB);
    expect(Buffer.from(k1.privKey).toString("hex")).not.toBe(Buffer.from(k2.privKey).toString("hex"));
  });

  it("derives a valid secp256k1 key usable for ECIES round-trip", () => {
    const { privKey, pubKey } = deriveKeypairFromSignature(sigA);
    expect(secp256k1.utils.isValidPrivateKey(privKey)).toBe(true);
    const dataKey = new Uint8Array(32).fill(0x7f);
    const recovered = eciesDecrypt(privKey, eciesEncrypt(pubKey, dataKey));
    expect(recovered).toEqual(dataKey);
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
