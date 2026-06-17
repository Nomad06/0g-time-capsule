/**
 * Typed viem wrappers around TimeCapsule.sol.
 * All reads go through publicClient; writes require walletClient.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  type WalletClient,
  type PublicClient,
  type Hash,
} from "viem";
import { zeroGTestnet, CONTRACT_ADDRESSES, TIME_CAPSULE_ABI } from "../constants/contracts";
import type { OnChainCapsule, TriggerType } from "./types";

// ── Clients ───────────────────────────────────────────────────────────────────

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: zeroGTestnet,
    transport: http(),
  });
}

export function getWalletClient(): WalletClient {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet detected — install MetaMask");
  }
  return createWalletClient({
    chain: zeroGTestnet,
    transport: custom(window.ethereum),
  });
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
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

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
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

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

export async function getOwnerCapsules(owner: `0x${string}`): Promise<`0x${string}`[]> {
  const pub = getPublicClient();
  const ids = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "getOwnerCapsules",
    args:         [owner],
  });
  return ids as `0x${string}`[];
}

export async function getRecipientCapsules(recipient: `0x${string}`): Promise<`0x${string}`[]> {
  const pub = getPublicClient();
  const ids = await pub.readContract({
    address:      CONTRACT_ADDRESSES.TimeCapsule,
    abi:          TIME_CAPSULE_ABI,
    functionName: "getRecipientCapsules",
    args:         [recipient],
  });
  return ids as `0x${string}`[];
}
