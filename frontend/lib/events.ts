import { getPublicClient } from "./contract";
import { CONTRACT_ADDRESSES, TIME_CAPSULE_ABI } from "../constants/contracts";
import type { OnChainCapsule } from "./types";
import { parseEventLogs } from "viem";

export interface CapsuleSummary {
  capsuleId:   `0x${string}`;
  owner:       `0x${string}`;
  unlockTime:  bigint;
  triggerType: number;
  commitHash:  `0x${string}`;
}

export async function getAllCapsuleEvents(limit = 200): Promise<CapsuleSummary[]> {
  const pub = getPublicClient();

  const rawLogs = await pub.getLogs({
    address:   CONTRACT_ADDRESSES.TimeCapsule,
    fromBlock: 0n,
    toBlock:   "latest",
  });

  const logs = parseEventLogs({
    abi:       TIME_CAPSULE_ABI,
    logs:      rawLogs,
    eventName: "CapsuleSealed",
  });

  const recent = logs.slice(-limit).reverse();

  return recent.map(log => ({
    capsuleId:   log.args.capsuleId as `0x${string}`,
    owner:       log.args.owner    as `0x${string}`,
    unlockTime:  log.args.unlockTime as bigint,
    triggerType: log.args.triggerType as number,
    commitHash:  log.args.commitHash  as `0x${string}`,
  }));
}

export async function batchGetCapsules(ids: `0x${string}`[]): Promise<OnChainCapsule[]> {
  const pub = getPublicClient();
  const results = await Promise.allSettled(
    ids.map(id =>
      pub.readContract({
        address:      CONTRACT_ADDRESSES.TimeCapsule,
        abi:          TIME_CAPSULE_ABI,
        functionName: "getCapsule",
        args:         [id],
      }) as Promise<OnChainCapsule>
    )
  );
  return results
    .filter((r): r is PromiseFulfilledResult<OnChainCapsule> => r.status === "fulfilled")
    .map(r => r.value);
}
