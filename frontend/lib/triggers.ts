/**
 * Typed viem wrappers for DeadManSwitch and MultiSigReveal trigger contracts.
 */

import type { Hash } from "viem";
import {
  zeroGTestnet,
  CONTRACT_ADDRESSES,
  DEAD_MAN_SWITCH_ABI,
  MULTI_SIG_REVEAL_ABI,
} from "../constants/contracts";
import { getPublicClient, getWalletClient } from "./contract";
import type { SwitchInfo, VaultInfo } from "./types";

// ── DeadManSwitch ─────────────────────────────────────────────────────────────

export async function armSwitch(
  capsuleId: `0x${string}`,
  owner:     `0x${string}`,
  interval:  bigint          // seconds
): Promise<Hash> {
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

  const tx = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.DeadManSwitch,
    abi:          DEAD_MAN_SWITCH_ABI,
    functionName: "arm",
    args:         [capsuleId, owner, interval],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function checkin(capsuleId: `0x${string}`): Promise<Hash> {
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

  const tx = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.DeadManSwitch,
    abi:          DEAD_MAN_SWITCH_ABI,
    functionName: "checkin",
    args:         [capsuleId],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function triggerSwitch(capsuleId: `0x${string}`): Promise<Hash> {
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

  const tx = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.DeadManSwitch,
    abi:          DEAD_MAN_SWITCH_ABI,
    functionName: "trigger",
    args:         [capsuleId],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function getSwitchInfo(capsuleId: `0x${string}`): Promise<SwitchInfo | null> {
  const pub = getPublicClient();
  const [sw, deadline, overdue] = await Promise.all([
    pub.readContract({
      address:      CONTRACT_ADDRESSES.DeadManSwitch,
      abi:          DEAD_MAN_SWITCH_ABI,
      functionName: "switches",
      args:         [capsuleId],
    }),
    pub.readContract({
      address:      CONTRACT_ADDRESSES.DeadManSwitch,
      abi:          DEAD_MAN_SWITCH_ABI,
      functionName: "getDeadline",
      args:         [capsuleId],
    }),
    pub.readContract({
      address:      CONTRACT_ADDRESSES.DeadManSwitch,
      abi:          DEAD_MAN_SWITCH_ABI,
      functionName: "isOverdue",
      args:         [capsuleId],
    }),
  ]);

  const [owner, , interval, lastCheckin, triggered, revealed] = sw as [
    `0x${string}`, `0x${string}`, bigint, bigint, boolean, boolean
  ];

  if (owner === "0x0000000000000000000000000000000000000000") return null;

  return {
    owner,
    interval,
    lastCheckin,
    triggered,
    revealed,
    deadline: deadline as bigint,
    overdue:  overdue as boolean,
  };
}

// ── MultiSigReveal ────────────────────────────────────────────────────────────

export async function createVault(
  capsuleId: `0x${string}`,
  owner:     `0x${string}`,
  signers:   `0x${string}`[],
  threshold: number
): Promise<Hash> {
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

  const tx = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "create",
    args:         [capsuleId, owner, signers, threshold],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function approveReveal(capsuleId: `0x${string}`): Promise<Hash> {
  const wallet = getWalletClient();
  const pub    = getPublicClient();
  const [account] = await wallet.getAddresses();

  const tx = await wallet.writeContract({
    account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "approve",
    args:         [capsuleId],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function getVaultInfo(capsuleId: `0x${string}`): Promise<VaultInfo | null> {
  const pub = getPublicClient();
  const raw = await pub.readContract({
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "getVault",
    args:         [capsuleId],
  }) as [`0x${string}`, number, number, boolean, `0x${string}`[]];

  const [owner, threshold, approvalCount, revealed, signers] = raw;
  if (owner === "0x0000000000000000000000000000000000000000") return null;

  return { owner, threshold, approvalCount, revealed, signers };
}

export async function hasApproved(
  capsuleId: `0x${string}`,
  signer:    `0x${string}`
): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "hasApproved",
    args:         [capsuleId, signer],
  });
}

export async function multisigCanReveal(capsuleId: `0x${string}`): Promise<boolean> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.MultiSigReveal,
    abi:          MULTI_SIG_REVEAL_ABI,
    functionName: "canReveal",
    args:         [capsuleId, "0x0000000000000000000000000000000000000000"],
  });
}
