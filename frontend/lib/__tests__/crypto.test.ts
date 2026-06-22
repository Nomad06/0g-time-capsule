import { describe, it, expect } from "vitest";
import {
  encryptForSeal,
  decryptFromReveal,
  makeCommitHash,
  hexToBytes,
  bytesToHex,
  NONCE_LEN,
} from "../crypto";

describe("encryptForSeal / decryptFromReveal round-trip", () => {
  it("decrypts to original plaintext for short message", () => {
    const plaintext = "Hello, time capsule!";
    const round = 12345;
    const { packed, timelockHeader } = encryptForSeal(plaintext, round);
    const result = decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("decrypts to original plaintext for long message (1 MB)", () => {
    const plaintext = "x".repeat(1_000_000);
    const round = 99999;
    const { packed, timelockHeader } = encryptForSeal(plaintext, round);
    const result = decryptFromReveal(packed, timelockHeader);
    expect(result).toBe(plaintext);
  });

  it("different rounds produce different ciphertexts", () => {
    const plaintext = "same message";
    const { packed: p1 } = encryptForSeal(plaintext, 1);
    const { packed: p2 } = encryptForSeal(plaintext, 2);
    expect(Buffer.from(p1).toString("hex")).not.toBe(Buffer.from(p2).toString("hex"));
  });

  it("timelockHeader is exactly 100 bytes", () => {
    const { timelockHeader } = encryptForSeal("test", 1);
    expect(timelockHeader.length).toBe(100);
  });

  it("tampered ciphertext throws (AES-GCM auth tag failure)", () => {
    const { packed, timelockHeader } = encryptForSeal("secret", 1);
    const tampered = new Uint8Array(packed);
    tampered[NONCE_LEN + 5] ^= 0xff; // flip a bit in ciphertext
    expect(() => decryptFromReveal(tampered, timelockHeader)).toThrow();
  });

  it("wrong timelockHeader throws", () => {
    const { packed, timelockHeader } = encryptForSeal("secret", 1);
    const { timelockHeader: otherHeader } = encryptForSeal("secret", 2);
    expect(() => decryptFromReveal(packed, otherHeader)).toThrow();
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
  it("packed starts with 12-byte nonce", () => {
    const { packed } = encryptForSeal("test", 42);
    expect(packed.length).toBeGreaterThan(NONCE_LEN);
  });

  it("commitHash matches makeCommitHash(plaintext)", () => {
    const pt = "verify me";
    const { commitHash } = encryptForSeal(pt, 1);
    expect(commitHash).toBe(makeCommitHash(pt));
  });

  it("dataKey is 32 bytes", () => {
    const { dataKey } = encryptForSeal("test", 1);
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
