"use client";

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { useEffect, useState } from "react";

const mainnetClient = createPublicClient({
  chain:     mainnet,
  transport: http("https://eth.llamarpc.com"),
});

const cache = new Map<string, string | null>();

export async function resolveEns(address: `0x${string}`): Promise<string | null> {
  const key = address.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const name = await mainnetClient.getEnsName({ address });
    cache.set(key, name ?? null);
    return name ?? null;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function useEnsName(address: `0x${string}` | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!address) return;
    resolveEns(address).then(setName);
  }, [address]);
  return name;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
