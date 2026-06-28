/**
 * Typed viem wrappers around TimeCapsule.sol.
 * All reads go through publicClient; writes require walletClient.
 */

import {
  createPublicClient,
  http,
  publicActions,
  parseEventLogs,
  WaitForTransactionReceiptTimeoutError,
  type WalletClient,
  type PublicClient,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { getWalletClient as wagmiGetWalletClient } from "@wagmi/core";
import { activeWagmiConfig } from "./active-wagmi-config";
import { ensureGas } from "./relay";
import { zeroGTestnet, CONTRACT_ADDRESSES, TIME_CAPSULE_ABI, KEY_REGISTRY_ABI } from "../constants/contracts";
import type { OnChainCapsule, TriggerType } from "./types";

// ── Clients ───────────────────────────────────────────────────────────────────

let _publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: zeroGTestnet,
    transport: http(),
  });
  return _publicClient;
}

// Gas-drip threshold: if a write-bound account holds less than this, top it up
// from the relayer so embedded-wallet users never hit the faucet. Funded
// wallets (advanced users) skip the round-trip entirely.
const MIN_GAS_WEI = 5_000_000_000_000_000n; // 0.005 A0GI

/** Tops up a near-empty account via the relayer; never throws (best-effort). */
async function topUpIfNeeded(address: `0x${string}`): Promise<void> {
  try {
    const balance = await getPublicClient().getBalance({ address });
    if (balance >= MIN_GAS_WEI) return;
    await ensureGas(address);
  } catch (e) {
    // Best-effort: if the wallet truly has no gas the write will surface its
    // own "insufficient funds" error.
    console.warn("[gas-drip] skipped", e);
  }
}

export async function getWalletClient(): Promise<WalletClient & { account: NonNullable<WalletClient["account"]> }> {
  const client = await wagmiGetWalletClient(activeWagmiConfig);
  if (!client) throw new Error("No wallet connected");
  if (!client.account) throw new Error("Wallet connected but no account available");
  const chainId = await client.getChainId();
  if (chainId !== zeroGTestnet.id) {
    try {
      await client.switchChain({ id: zeroGTestnet.id });
    } catch {
      throw new Error(
        `Wrong network. Switch to 0G Testnet (chain ID ${zeroGTestnet.id}) in your wallet, then try again.`
      );
    }
    // Re-fetch after switch — old client is stale
    const switched = await wagmiGetWalletClient(activeWagmiConfig);
    if (!switched?.account) throw new Error("Switched to 0G Testnet — please try again.");
    await topUpIfNeeded(switched.account.address);
    return switched as WalletClient & { account: NonNullable<WalletClient["account"]> };
  }
  await topUpIfNeeded(client.account.address);
  return client as WalletClient & { account: NonNullable<WalletClient["account"]> };
}

// ── Private helpers ────────────────────────────────────────────────────────────

type WriteContractArgs = Parameters<WalletClient["writeContract"]>[0];

type ReceiptReader = Pick<PublicClient, "getTransactionReceipt">;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Receipt wait that races the wallet's own RPC against the public RPC.
 *
 * The wallet broadcasts the tx through ITS node (e.g. Privy's), which therefore
 * knows the tx immediately. The public endpoint (`getPublicClient()`) is
 * load-balanced across replicas, so a poll there often hits a node that hasn't
 * seen the broadcast yet → "receipt not found" until it propagates. By polling
 * BOTH each cycle and taking whichever returns first, we remove that
 * cross-node lag at the source; the public node is a fallback if the wallet
 * transport can't read receipts.
 *
 * Pass `walletClient` (from getWalletClient) to enable the dual-poll; without it
 * this falls back to public-only polling.
 */
export async function waitForReceipt(
  hash: Hash,
  walletClient?: WalletClient,
): Promise<TransactionReceipt> {
  const readers: ReceiptReader[] = [getPublicClient()];
  if (walletClient) {
    // Extend the wallet client with public actions so getTransactionReceipt runs
    // over the wallet's own transport (the node that broadcast the tx).
    readers.unshift(walletClient.extend(publicActions) as unknown as ReceiptReader);
  }

  // 0G testnet + embedded-wallet RPC propagation can lag past a minute under
  // load, so wait generously.
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    for (const reader of readers) {
      try {
        const receipt = await reader.getTransactionReceipt({ hash });
        if (receipt) return receipt;
      } catch {
        // Not mined on this node yet (or transient) — try the next source / cycle.
      }
    }
    await sleep(3_000);
  }
  throw new WaitForTransactionReceiptTimeoutError({ hash });
}

/**
 * Wallet write + receipt wait in one call.
 * Injects account and chain so callers don't repeat them.
 */
async function writeAndWait(args: Omit<WriteContractArgs, "account" | "chain">): Promise<Hash> {
  const wallet = await getWalletClient();
  const txHash = await wallet.writeContract({
    ...args,
    account: wallet.account,
    chain:   zeroGTestnet,
  } as WriteContractArgs);
  await waitForReceipt(txHash, wallet);
  return txHash;
}

// ── Write: seal ───────────────────────────────────────────────────────────────

export interface SealContractParams {
  storageRoot:     `0x${string}`;
  commitHash:      `0x${string}`;
  timelockHeader:  `0x${string}`;
  unlockTime:      bigint;          // unix seconds
  recipients:      `0x${string}`[];
  triggerType?:    TriggerType;
  triggerContract?: `0x${string}`;
}

export interface SealTxResult {
  txHash:    Hash;
  capsuleId: `0x${string}`;
}

export async function sealOnChain(params: SealContractParams): Promise<SealTxResult> {
  const wallet = await getWalletClient();
  const account = wallet.account;

  const txHash = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "seal",
    args: [
      params.storageRoot,
      params.commitHash,
      params.timelockHeader,
      params.unlockTime,
      0n,                                          // unlockBlock = 0
      params.recipients,
      params.triggerType ?? 0,                     // TriggerType.TIME
      params.triggerContract ?? "0x0000000000000000000000000000000000000000",
    ],
  });

  const receipt = await waitForReceipt(txHash, wallet);

  const logs = parseEventLogs({
    abi:  TIME_CAPSULE_ABI,
    logs: receipt.logs,
    eventName: "CapsuleSealed",
  });

  if (!logs[0]) throw new Error("CapsuleSealed event not found in receipt");
  const capsuleId = logs[0].args.capsuleId as `0x${string}`;

  return { txHash, capsuleId };
}

// ── Write: reveal ─────────────────────────────────────────────────────────────

export interface RevealTxResult {
  txHash:          Hash;
  timelockHeader:  `0x${string}`;  // emitted in CapsuleRevealed
}

export async function revealOnChain(capsuleId: `0x${string}`): Promise<RevealTxResult> {
  const wallet = await getWalletClient();
  const account = wallet.account;

  const txHash = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "reveal",
    args: [capsuleId],
  });

  const receipt = await waitForReceipt(txHash, wallet);

  const logs = parseEventLogs({
    abi:  TIME_CAPSULE_ABI,
    logs: receipt.logs,
    eventName: "CapsuleRevealed",
  });

  if (!logs[0]) throw new Error("CapsuleRevealed event not found in receipt");
  const timelockHeader = logs[0].args.timelockHeader as `0x${string}`;

  return { txHash, timelockHeader };
}

// ── Read: getCapsule ──────────────────────────────────────────────────────────

export async function getCapsule(capsuleId: `0x${string}`): Promise<OnChainCapsule> {
  const pub = getPublicClient();
  const raw = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "getCapsule",
    args:         [capsuleId],
  });
  // viem returns a typed tuple matching our struct
  return raw as unknown as OnChainCapsule;
}

export async function isUnlocked(capsuleId: `0x${string}`): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "isUnlocked",
    args:         [capsuleId],
  });
}

export async function verifyOnChain(
  capsuleId:    `0x${string}`,
  plaintextHash: `0x${string}`
): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "verify",
    args:         [capsuleId, plaintextHash],
  });
}

/**
 * Generic helper: read capsule arrays by role (owner or recipient).
 */
async function readCapsulesByRole(
  functionName: "getOwnerCapsules" | "getRecipientCapsules",
  address: `0x${string}`
): Promise<`0x${string}`[]> {
  const pub = getPublicClient();
  const ids = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName,
    args:         [address],
  });
  return ids as `0x${string}`[];
}

export async function getOwnerCapsules(owner: `0x${string}`): Promise<`0x${string}`[]> {
  return readCapsulesByRole("getOwnerCapsules", owner);
}

export async function getRecipientCapsules(recipient: `0x${string}`): Promise<`0x${string}`[]> {
  return readCapsulesByRole("getRecipientCapsules", recipient);
}

// ── Stage 2: recipient keys ───────────────────────────────────────────────────

export async function setRecipientKeys(
  capsuleId:     `0x${string}`,
  recipients:    `0x${string}`[],
  encryptedKeys: `0x${string}`[]
): Promise<Hash> {
  return writeAndWait({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "setRecipientKeys",
    args:         [capsuleId, recipients, encryptedKeys],
  });
}

export async function getRecipientKey(
  capsuleId: `0x${string}`,
  recipient: `0x${string}`
): Promise<`0x${string}`> {
  const pub = getPublicClient();
  const raw = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "getRecipientKey",
    args:         [capsuleId, recipient],
  });
  return raw as `0x${string}`;
}

// ── Stage 2: key registry ─────────────────────────────────────────────────────

export async function registerEncryptionKey(pubkeyHex: `0x${string}`): Promise<Hash> {
  return writeAndWait({
    address:      CONTRACT_ADDRESSES.KeyRegistry,
    abi:          KEY_REGISTRY_ABI,
    functionName: "registerKey",
    args:         [pubkeyHex],
  });
}

export async function getEncryptionKey(wallet: `0x${string}`): Promise<`0x${string}`> {
  const pub = getPublicClient();
  const raw = await pub.readContract({
    address:      CONTRACT_ADDRESSES.KeyRegistry,
    abi:          KEY_REGISTRY_ABI,
    functionName: "getKey",
    args:         [wallet],
  });
  return raw as `0x${string}`;
}

export async function hasEncryptionKey(wallet: `0x${string}`): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.KeyRegistry,
    abi:          KEY_REGISTRY_ABI,
    functionName: "hasKey",
    args:         [wallet],
  });
}
