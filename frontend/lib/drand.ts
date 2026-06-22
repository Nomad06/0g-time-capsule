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

export async function getOrCreateDrandClient(): Promise<HttpChainClient> {
  if (_client) return _client;

  let lastErr: unknown;
  for (const url of DRAND_URLS) {
    try {
      const chain = new HttpCachingChain(
        `${url}/${DRAND_QUICKNET_CHAIN}`,
        { disableBeaconVerification: false, noCache: false }
      );
      const candidate = new HttpChainClient(chain);
      // probe — throws if unreachable
      await candidate.chain().info();
      _client = candidate;
      return _client;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`All drand endpoints unreachable: ${lastErr}`);
}

/** @deprecated use getOrCreateDrandClient() */
export function getDrandClient(): HttpChainClient {
  // Return cached client synchronously if available; caller must await getOrCreateDrandClient() first.
  if (_client) return _client;
  // Fallback: return first URL client without probe (original behaviour)
  const chain = new HttpCachingChain(
    `${DRAND_URLS[0]}/${DRAND_QUICKNET_CHAIN}`,
    { disableBeaconVerification: false, noCache: false }
  );
  return (_client = new HttpChainClient(chain));
}

/**
 * Round number that will be published at or after `unlockTime`.
 * This is the round used to timelock-encrypt the capsule key.
 */
export async function roundForTime(unlockTime: Date): Promise<number> {
  const client = await getOrCreateDrandClient();
  const info = await client.chain().info();
  return roundAt(unlockTime.getTime(), info);
}

/**
 * Timestamp (ms) when a specific drand round will be published.
 */
export async function timeForRound(round: number): Promise<Date> {
  const client = await getOrCreateDrandClient();
  const info = await client.chain().info();
  return new Date(roundTime(info, round));
}

/**
 * Fetch the beacon for a specific round.
 * Will reject if the round hasn't been published yet.
 */
export async function fetchRound(round: number) {
  const client = await getOrCreateDrandClient();
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
