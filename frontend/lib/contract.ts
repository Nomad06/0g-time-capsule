/**
 * Typed viem wrappers around TimeCapsule.sol.
 * All reads go through publicClient; writes require walletClient.
 */

import {
  createPublicClient,
  http,
  parseEventLogs,
  type WalletClient,
  type PublicClient,
  type Hash,
} from "viem";
import { getWalletClient as wagmiGetWalletClient } from "@wagmi/core";
import { wagmiConfig } from "./wagmi-config";
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

export async function getWalletClient(): Promise<WalletClient & { account: NonNullable<WalletClient["account"]> }> {
  const client = await wagmiGetWalletClient(wagmiConfig);
  if (!client) throw new Error("No wallet connected");
  if (!client.account) throw new Error("Wallet connected but no account available");
  const chainId = await client.getChainId();
  if (chainId !== zeroGTestnet.id) {
    await client.switchChain({ id: zeroGTestnet.id });
    // Re-fetch after switch — old client is stale
    const switched = await wagmiGetWalletClient(wagmiConfig);
    if (!switched?.account) throw new Error("Switched to 0G Testnet — please press Register again.");
    return switched as WalletClient & { account: NonNullable<WalletClient["account"]> };
  }
  return client as WalletClient & { account: NonNullable<WalletClient["account"]> };
}

// ── Private helpers ────────────────────────────────────────────────────────────

type WriteContractArgs = Parameters<WalletClient["writeContract"]>[0];

/**
 * Wallet write + receipt wait in one call.
 * Injects account and chain so callers don't repeat them.
 */
async function writeAndWait(args: Omit<WriteContractArgs, "account" | "chain">): Promise<Hash> {
  const wallet = await getWalletClient();
  const pub    = getPublicClient();
  const txHash = await wallet.writeContract({
    ...args,
    account: wallet.account,
    chain:   zeroGTestnet,
  } as WriteContractArgs);
  await pub.waitForTransactionReceipt({ hash: txHash });
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
  const pub    = getPublicClient();
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

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

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
  const pub    = getPublicClient();
  const account = wallet.account;

  const txHash = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "reveal",
    args: [capsuleId],
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

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
