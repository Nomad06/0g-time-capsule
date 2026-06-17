import { getPublicClient } from "./contract";
import { CONTRACT_ADDRESSES, TIME_CAPSULE_ABI } from "../constants/contracts";
import type { OnChainCapsule } from "./types";
import { parseEventLogs, type Log } from "viem";

export interface CapsuleSummary {
  capsuleId:   `0x${string}`;
  owner:       `0x${string}`;
  unlockTime:  bigint;
  triggerType: number;
  commitHash:  `0x${string}`;
}

// Set NEXT_PUBLIC_DEPLOY_BLOCK to the block the TimeCapsule contract was deployed.
// Without it we chunk from (latest - FALLBACK_SCAN_BLOCKS) to avoid RPC range limits.
const DEPLOY_BLOCK: bigint | null =
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK
    ? BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK)
    : null;
const FALLBACK_SCAN_BLOCKS = 500_000n;
const CHUNK_SIZE            = 50_000n;

/** Collect raw getLogs results across chunks; parseEventLogs is done by caller. */
async function _collectRawLogs(fromBlock: bigint): Promise<Log[]> {
  const pub    = getPublicClient();
  const latest = await pub.getBlockNumber();
  const raw: Log[] = [];

  for (let lo = fromBlock; lo <= latest; lo += CHUNK_SIZE) {
    const hi = lo + CHUNK_SIZE - 1n < latest ? lo + CHUNK_SIZE - 1n : latest;
    try {
      const chunk = await pub.getLogs({
        address:   CONTRACT_ADDRESSES.TimeCapsule,
        fromBlock: lo,
        toBlock:   hi,
      });
      raw.push(...chunk);
    } catch {
      // RPC may reject even 50k-block windows; skip and continue rather than failing all
    }
  }
  return raw;
}

export async function getAllCapsuleEvents(limit = 200): Promise<CapsuleSummary[]> {
  const pub       = getPublicClient();
  const latest    = await pub.getBlockNumber();
  const fromBlock = DEPLOY_BLOCK ?? (latest > FALLBACK_SCAN_BLOCKS ? latest - FALLBACK_SCAN_BLOCKS : 0n);

  const rawLogs = await _collectRawLogs(fromBlock);

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
