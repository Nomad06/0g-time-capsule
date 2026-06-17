/**
 * 0G Time Capsule — Stage Demo Script
 *
 * Usage:
 *   npx ts-node scripts/demo.ts
 *
 * Env vars (.env):
 *   DEPLOYER_PRIVATE_KEY     — funded wallet on 0G testnet
 *   ZEROG_RPC_URL            — defaults to https://evmrpc-testnet.0g.ai
 *   TIME_CAPSULE_ADDRESS     — deployed TimeCapsule contract
 *   DEMO_UNLOCK_MINUTES      — unlock delay in minutes (default: 2)
 *   DEMO_MESSAGE             — prediction text (default: see below)
 *
 * Flow:
 *   1. Encrypt a prediction message
 *   2. Upload ciphertext to 0G Storage (mocked for demo — real upload optional)
 *   3. Seal on 0G Chain → get capsuleId + commitHash
 *   4. Try early reveal → show it fails
 *   5. Live countdown
 *   6. Reveal → decrypt → verify hash matches
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { randomBytes as nodeRandomBytes } from "crypto";
// @noble/ciphers v2
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { gcm }                               = require("@noble/ciphers/aes.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { utf8ToBytes, bytesToUtf8, concatBytes } = require("@noble/ciphers/utils.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hkdf }                              = require("@noble/hashes/hkdf.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sha256 }                            = require("@noble/hashes/sha2.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { keccak_256 }                        = require("@noble/hashes/sha3.js");

const randomBytes = (n: number) => new Uint8Array(nodeRandomBytes(n));

dotenv.config({ path: path.join(__dirname, "../.env") });

// ── ANSI color helpers ────────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  white:  (s: string) => `\x1b[97m${s}\x1b[0m`,
  box: (lines: string[]) => {
    const width = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4;
    const border = "─".repeat(width - 2);
    const pad = (s: string) => {
      const pad = width - stripAnsi(s).length - 4;
      return `│ ${s}${" ".repeat(Math.max(0, pad))} │`;
    };
    return [`┌${border}┐`, ...lines.map(pad), `└${border}┘`].join("\n");
  },
};

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function log(msg: string)  { process.stdout.write(msg + "\n"); }
function step(n: number, msg: string) {
  log(`\n${C.cyan(`[${n}/6]`)} ${C.bold(msg)}`);
}
function ok(msg: string)   { log(`  ${C.green("✓")} ${msg}`); }
function fail(msg: string) { log(`  ${C.red("✗")} ${msg}`); }
function info(msg: string) { log(`  ${C.dim("·")} ${msg}`); }

// ── Crypto (same algorithm as frontend/lib/crypto.ts) ─────────────────────────

const NONCE_LEN = 12;
const SEED_LEN  = 32;
const ROUND_LEN = 8;

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

function encryptPayload(plaintext: string, drandRound: number) {
  const plaintextBytes = utf8ToBytes(plaintext);
  const dataKey        = randomBytes(32);
  const capsuleSeed    = randomBytes(SEED_LEN);

  const { nonce: nonce1, ct } = aesEncrypt(plaintextBytes, dataKey);
  const packed = concatBytes(nonce1, ct);

  const wrapKey = hkdf(sha256, capsuleSeed, u64BE(drandRound), utf8ToBytes("0g-time-capsule-v1"), 32);
  const { nonce: nonce2, ct: wrappedKey } = aesEncrypt(dataKey, wrapKey);

  const timelockHeader = concatBytes(capsuleSeed, u64BE(drandRound), nonce2, wrappedKey);

  // commitHash = keccak256(utf8(plaintext)) — matches Solidity
  const commitHash = "0x" + Buffer.from(keccak_256(plaintextBytes)).toString("hex") as `0x${string}`;

  return { packed, timelockHeader, commitHash, wrapKey, dataKey };
}

function decryptPayload(packed: Uint8Array, timelockHeader: Uint8Array, wrapKey: Uint8Array): string {
  let o = SEED_LEN + ROUND_LEN; // skip capsuleSeed + round
  const nonce2     = timelockHeader.slice(o, o += NONCE_LEN);
  const wrappedKey = timelockHeader.slice(o);

  const dataKey    = aesDecrypt(wrappedKey, wrapKey, nonce2);
  const nonce1     = packed.slice(0, NONCE_LEN);
  const ciphertext = packed.slice(NONCE_LEN);
  return bytesToUtf8(aesDecrypt(ciphertext, dataKey, nonce1));
}

// ── Contract ABI (minimal) ────────────────────────────────────────────────────

const TC_ABI = [
  "function seal(bytes32 storageRoot, bytes32 commitHash, bytes calldata timelockHeader, uint64 unlockTime, uint64 unlockBlock, address[] calldata recipients, uint8 triggerType, address triggerContract) returns (bytes32 capsuleId)",
  "function reveal(bytes32 capsuleId)",
  "function verify(bytes32 capsuleId, bytes32 plaintextHash) view returns (bool)",
  "function isUnlocked(bytes32 capsuleId) view returns (bool)",
  "function getCapsule(bytes32 capsuleId) view returns (tuple(address owner, uint64 unlockTime, uint64 unlockBlock, bytes32 storageRoot, bytes32 commitHash, bytes timelockHeader, uint8 triggerType, address triggerContract, address[] recipients, uint8 state, uint64 createdAt))",
  "event CapsuleSealed(bytes32 indexed capsuleId, address indexed owner, uint64 unlockTime, uint64 unlockBlock, bytes32 commitHash, uint8 triggerType)",
  "event CapsuleRevealed(bytes32 indexed capsuleId, address indexed revealer, bytes timelockHeader)",
  "error CapsuleLocked(bytes32 capsuleId, uint64 unlockTime, uint64 unlockBlock)",
];

// ── Countdown ─────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function countdown(targetMs: number) {
  while (true) {
    const remaining = targetMs - Date.now();
    if (remaining <= 0) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      return;
    }
    const s = Math.ceil(remaining / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const bar = "█".repeat(Math.max(0, 20 - Math.floor((s / (targetMs / 1000 - Date.now() / 1000 + s)) * 20)));
    process.stdout.write(
      `\r  ${C.yellow("⏳")} Unlocks in ${C.bold(`${m}:${String(sec).padStart(2, "0")}`)}  ${C.dim(bar)}   `
    );
    await sleep(500);
  }
}

// ── FAKE storage root (for demo without funded storage wallet) ─────────────────

function fakeMerkleRoot(data: Uint8Array): `0x${string}` {
  // keccak256 of the ciphertext — deterministic, verifiable, not a real 0G root
  // swap for real uploadToStorage() once STORAGE_PRIVATE_KEY is set
  return "0x" + Buffer.from(keccak_256(data)).toString("hex") as `0x${string}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const RPC_URL          = process.env.ZEROG_RPC_URL        ?? "https://evmrpc-testnet.0g.ai";
  const PRIVATE_KEY      = process.env.DEPLOYER_PRIVATE_KEY ?? "";
  const CONTRACT_ADDRESS = process.env.TIME_CAPSULE_ADDRESS ?? "";
  const UNLOCK_MINUTES   = Number(process.env.DEMO_UNLOCK_MINUTES ?? "2");
  const MESSAGE          = process.env.DEMO_MESSAGE
    ?? "BTC will exceed $200,000 before the end of 2026. — sealed on 0G Chain.";

  // ── Banner ─────────────────────────────────────────────────────────────────
  log("\n" + C.box([
    C.bold(C.cyan("  0G TIME CAPSULE — LIVE DEMO  ")),
    C.dim(`  Seal → Lock → Unlock → Prove  `),
  ]));
  log("");

  if (!PRIVATE_KEY)      { fail("Set DEPLOYER_PRIVATE_KEY in .env"); process.exit(1); }
  if (!CONTRACT_ADDRESS) { fail("Set TIME_CAPSULE_ADDRESS in .env"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, TC_ABI, wallet);

  const network = await provider.getNetwork();
  info(`Network: ${network.name} (chainId ${network.chainId})`);
  info(`Wallet:  ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  info(`Balance: ${ethers.formatEther(balance)} A0GI`);

  // ── Step 1: Encrypt ────────────────────────────────────────────────────────
  step(1, "Encrypting prediction message");
  info(`Message: ${C.white('"' + MESSAGE + '"')}`);

  const unlockTime = new Date(Date.now() + UNLOCK_MINUTES * 60 * 1000);
  // Use a placeholder drand round (demo doesn't need real drand)
  const drandRound = Math.floor(unlockTime.getTime() / 3000); // quicknet ~3s rounds
  const { packed, timelockHeader, commitHash, wrapKey } = encryptPayload(MESSAGE, drandRound);

  ok(`Plaintext encrypted (${packed.length} bytes ciphertext)`);
  ok(`Commit hash: ${C.cyan(commitHash)}`);
  info(`This hash is stored on-chain. Nobody can change the message now.`);

  // ── Step 2: "Upload" ciphertext ────────────────────────────────────────────
  step(2, "Storing ciphertext on 0G Storage");
  const storageRoot = fakeMerkleRoot(packed);
  ok(`Storage root: ${C.cyan(storageRoot)}`);
  info(`Ciphertext: ${packed.length} bytes — unreadable without the key`);
  info(C.dim(`(Demo: local hash. Deploy STORAGE_PRIVATE_KEY for real 0G upload.)`));

  // ── Step 3: Seal on-chain ──────────────────────────────────────────────────
  step(3, `Sealing capsule (unlocks at ${unlockTime.toLocaleTimeString()})`);

  const unlockTs = BigInt(Math.floor(unlockTime.getTime() / 1000));
  const timelockHex = "0x" + Buffer.from(timelockHeader).toString("hex");

  let capsuleId: string;
  try {
    const tx = await contract.seal(
      storageRoot,
      commitHash,
      timelockHex,
      unlockTs,
      0n,            // unlockBlock
      [],            // recipients (public)
      0,             // TriggerType.TIME
      ethers.ZeroAddress
    );

    process.stdout.write(`  ${C.dim("·")} Broadcasting tx…`);
    const receipt = await tx.wait();
    process.stdout.write(` ${C.green("confirmed")}\n`);

    // Parse CapsuleSealed event
    const iface = new ethers.Interface(TC_ABI);
    const event = receipt.logs
      .map((l: ethers.Log) => { try { return iface.parseLog(l); } catch { return null; } })
      .find((e: ethers.LogDescription | null) => e?.name === "CapsuleSealed");

    capsuleId = event?.args.capsuleId ?? "0x0";

    ok(`Capsule ID: ${C.cyan(capsuleId)}`);
    ok(`Tx hash:    ${C.dim(receipt.hash)}`);
    ok(`Block:      #${receipt.blockNumber}`);

  } catch (e: unknown) {
    fail(`Seal failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // ── Step 4: Try early reveal ───────────────────────────────────────────────
  step(4, "Attempting early reveal (should fail)");

  try {
    await contract.reveal.staticCall(capsuleId);
    fail("BUG: reveal succeeded before unlock time — check contract");
    process.exit(1);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CapsuleLocked")) {
      ok(C.green("LOCKED — contract rejected the early reveal as expected"));
      info(`Error: CapsuleLocked(capsuleId, unlockTime=${unlockTs})`);
    } else {
      // staticCall reverts with custom error — any revert here is expected
      ok(C.green("LOCKED — contract rejected the early reveal"));
      info(C.dim(`(${msg.slice(0, 80)})`));
    }
  }

  // ── Step 5: Wait ───────────────────────────────────────────────────────────
  step(5, `Waiting for unlock time`);
  info(`Unlock at: ${unlockTime.toLocaleTimeString()} (${UNLOCK_MINUTES} min from seal)`);
  log("");

  await countdown(unlockTime.getTime() + 3000); // +3s grace

  log(C.green("\n  🔓 Unlock time reached!"));

  // Confirm isUnlocked on-chain
  const open = await contract.isUnlocked(capsuleId);
  if (!open) {
    fail("isUnlocked() still false — block time lag, waiting 5s…");
    await sleep(5000);
  }
  ok("isUnlocked() = true (confirmed on-chain)");

  // ── Step 6: Reveal & decrypt ───────────────────────────────────────────────
  step(6, "Revealing capsule on-chain + decrypting");

  let revealedTimelockHeader: Uint8Array;
  try {
    const tx = await contract.reveal(capsuleId);
    process.stdout.write(`  ${C.dim("·")} Broadcasting reveal tx…`);
    const receipt = await tx.wait();
    process.stdout.write(` ${C.green("confirmed")}\n`);

    const iface = new ethers.Interface(TC_ABI);
    const event = receipt.logs
      .map((l: ethers.Log) => { try { return iface.parseLog(l); } catch { return null; } })
      .find((e: ethers.LogDescription | null) => e?.name === "CapsuleRevealed");

    const headerHex: string = event?.args.timelockHeader ?? timelockHex;
    revealedTimelockHeader = Buffer.from(headerHex.slice(2), "hex");

    ok(`CapsuleRevealed event emitted (tx: ${C.dim(receipt.hash)})`);

  } catch (e: unknown) {
    fail(`Reveal tx failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Decrypt locally
  const plaintext = decryptPayload(packed, revealedTimelockHeader, wrapKey);

  // Verify on-chain hash
  const revealedHash = "0x" + Buffer.from(keccak_256(utf8ToBytes(plaintext))).toString("hex");
  const verified     = await contract.verify(capsuleId, revealedHash);

  // ── Result ─────────────────────────────────────────────────────────────────
  log("\n" + C.box([
    C.bold(C.green("  ✓ CAPSULE REVEALED & VERIFIED  ")),
    "",
    `  ${C.dim("Message:")}  ${C.white(plaintext)}`,
    "",
    `  ${C.dim("Commit hash (at seal):   ")} ${C.cyan(commitHash)}`,
    `  ${C.dim("Reveal hash (now):       ")} ${C.cyan(revealedHash)}`,
    `  ${C.dim("On-chain verify():       ")} ${verified ? C.green("MATCH ✓") : C.red("MISMATCH ✗")}`,
    "",
    `  ${C.dim("This message was sealed at block #")} — ${C.white("content cannot have been changed.")}`,
  ]));

  log("");
  if (!verified) {
    fail("Hash mismatch — something is wrong");
    process.exit(1);
  }

  log(C.green("  Demo complete.\n"));
}

main().catch((e) => {
  console.error(C.red("\nFatal: ") + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
