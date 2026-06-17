import { describe, it, expect, vi } from "vitest";
import {
  encryptForSeal,
  decryptFromReveal,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
  NONCE_LEN,
} from "../crypto";

// Mock tlock-js so tests run without real drand network access.
// The mock encodes (round, payload) losslessly so decrypt can recover the key.
vi.mock("tlock-js", () => ({
  timelockEncrypt: async (round: number, payload: Buffer): Promise<string> => {
    const roundBuf = Buffer.alloc(8);
    roundBuf.writeBigUInt64BE(BigInt(round));
    return "mock:" + Buffer.concat([roundBuf, payload]).toString("base64");
  },
  timelockDecrypt: async (ciphertext: string): Promise<Buffer> => {
    const b = Buffer.from(ciphertext.slice("mock:".length), "base64");
    return b.slice(8); // skip 8-byte round prefix
  },
}));

// Mock drand client — not needed since tlock-js is mocked, but crypto.ts
// calls getOrCreateDrandClient() before passing to tlock.
vi.mock("../drand", () => ({
  getOrCreateDrandClient: async () => ({}),
  roundForTime: async () => 12345,
  timeForRound: async () => new Date(),
  fetchRound:   async () => ({}),
}));

describe("encryptForSeal / decryptFromReveal round-trip (v2 tlock)", () => {
  it("decrypts to original plaintext for short message", async () => {
    const plaintext = "Hello, time capsule!";
    const { packed, timelockHeader } = await encryptForSeal(plaintext, 12345);
    const result = await decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("decrypts to original plaintext for long message (1 MB)", async () => {
    const plaintext = "x".repeat(1_000_000);
    const { packed, timelockHeader } = await encryptForSeal(plaintext, 99999);
    const result = await decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("different rounds produce different ciphertexts", async () => {
    const plaintext = "same message";
    const { packed: p1 } = await encryptForSeal(plaintext, 1);
    const { packed: p2 } = await encryptForSeal(plaintext, 2);
    expect(Buffer.from(p1).toString("hex")).not.toBe(Buffer.from(p2).toString("hex"));
  });

  it("timelockHeader is v2 format (version byte 0x02, contains round + ciphertext)", async () => {
    const { timelockHeader } = await encryptForSeal("test", 1);
    expect(timelockHeader[0]).toBe(0x02);              // version byte
    expect(timelockHeader.length).toBeGreaterThan(9); // version(1) + round(8) + ciphertext(n)
  });

  it("tampered ciphertext throws (AES-GCM auth tag failure)", async () => {
    const { packed, timelockHeader } = await encryptForSeal("secret", 1);
    const tampered = new Uint8Array(packed);
    tampered[NONCE_LEN + 5] ^= 0xff;
    await expect(decryptFromReveal(tampered, timelockHeader)).rejects.toThrow();
  });

  it("wrong timelockHeader throws (wrong dataKey → AES-GCM fail)", async () => {
    const { packed }                          = await encryptForSeal("secret", 1);
    const { timelockHeader: otherHeader }     = await encryptForSeal("secret", 2);
    await expect(decryptFromReveal(packed, otherHeader)).rejects.toThrow();
  });
});

describe("v1 legacy header backward-compat", () => {
  // Construct a v1 header (exactly 100 bytes) using the old HKDF scheme
  // to verify the backward-compat path still decrypts old capsules.
  it("decrypts v1 header without tlock", async () => {
    const { gcm }         = await import("@noble/ciphers/aes");
    const { randomBytes } = await import("@noble/ciphers/webcrypto");
    const { utf8ToBytes, bytesToUtf8, concatBytes } = await import("@noble/ciphers/utils");
    const { hkdf }        = await import("@noble/hashes/hkdf");
    const { sha256 }      = await import("@noble/hashes/sha256");

    const plaintext   = "legacy capsule";
    const drandRound  = 42;
    const dataKey     = randomBytes(32);
    const capsuleSeed = randomBytes(32);

    // Build packed (nonce1 + AES ciphertext)
    const nonce1 = randomBytes(12);
    const ct     = gcm(dataKey, nonce1).encrypt(utf8ToBytes(plaintext));
    const packed = concatBytes(nonce1, ct);

    // Build v1 header
    const roundBuf = new Uint8Array(8);
    new DataView(roundBuf.buffer).setBigUint64(0, BigInt(drandRound), false);
    const wrapKey = hkdf(sha256, capsuleSeed, roundBuf, utf8ToBytes("0g-time-capsule-v1"), 32);
    const nonce2  = randomBytes(12);
    const wrappedKey = gcm(wrapKey, nonce2).encrypt(dataKey);
    const timelockHeader = concatBytes(capsuleSeed, roundBuf, nonce2, wrappedKey);

    expect(timelockHeader.length).toBe(100);

    const result = await decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });
});

describe("makeCommitHash", () => {
  it("produces a 0x-prefixed 64-char hex string", () => {
    const h = makeCommitHash("hello");
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("same plaintext → same hash (deterministic)", () => {
    expect(makeCommitHash("abc")).toBe(makeCommitHash("abc"));
  });

  it("different plaintext → different hash", () => {
    expect(makeCommitHash("abc")).not.toBe(makeCommitHash("xyz"));
  });
});

describe("encryptForSeal output fields", () => {
  it("packed starts with 12-byte nonce", async () => {
    const { packed } = await encryptForSeal("test", 42);
    expect(packed.length).toBeGreaterThan(NONCE_LEN);
  });

  it("commitHash matches makeCommitHash(plaintext)", async () => {
    const pt = "verify me";
    const { commitHash } = await encryptForSeal(pt, 1);
    expect(commitHash).toBe(makeCommitHash(pt));
  });

  it("dataKey is 32 bytes", async () => {
    const { dataKey } = await encryptForSeal("test", 1);
    expect(dataKey.length).toBe(32);
  });
});

describe("hexToBytes / bytesToHex", () => {
  it("round-trips with 0x prefix", () => {
    const hex = "0xdeadbeef01020304";
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });

  it("round-trips without prefix", () => {
    const b = new Uint8Array([1, 2, 3, 255]);
    expect(hexToBytes(bytesToHex(b))).toEqual(b);
  });
});
