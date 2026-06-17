import {
  HttpCachingChain,
  HttpChainClient,
  roundAt,
  roundTime,
} from "drand-client";

// drand quicknet — 3-second rounds, BLS12-381 unchained
// https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info
export const DRAND_QUICKNET_CHAIN =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";

const DRAND_URLS = [
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
  "https://drand.cloudflare.com",
];

let _client: HttpChainClient | null = null;

export function getDrandClient(): HttpChainClient {
  if (_client) return _client;
  const chain = new HttpCachingChain(
    `${DRAND_URLS[0]}/${DRAND_QUICKNET_CHAIN}`,
    { disableBeaconVerification: false, noCache: false }
  );
  _client = new HttpChainClient(chain);
  return _client;
}

/**
 * Round number that will be published at or after `unlockTime`.
 * This is the round used to timelock-encrypt the capsule key.
 */
export async function roundForTime(unlockTime: Date): Promise<number> {
  const client = getDrandClient();
  const info = await client.chain().info();
  return roundAt(unlockTime.getTime(), info);
}

/**
 * Timestamp (ms) when a specific drand round will be published.
 */
export async function timeForRound(round: number): Promise<Date> {
  const client = getDrandClient();
  const info = await client.chain().info();
  return new Date(roundTime(info, round));
}

/**
 * Fetch the beacon for a specific round.
 * Will reject if the round hasn't been published yet.
 */
export async function fetchRound(round: number) {
  const client = getDrandClient();
  return client.get(round);
}

/**
 * Returns true if the drand round for `unlockTime` has been published.
 */
export async function isRoundAvailable(round: number): Promise<boolean> {
  try {
    await fetchRound(round);
    return true;
  } catch {
    return false;
  }
}
