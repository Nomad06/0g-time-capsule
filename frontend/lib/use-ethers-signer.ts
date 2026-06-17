"use client";

/**
 * Returns an ethers JsonRpcSigner derived from the wagmi-connected wallet.
 * Used to pass to 0G Storage SDK (uploadToStorage) which expects an ethers signer.
 */

import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import type { Client, Transport, Chain, Account } from "viem";

function clientToSigner(client: Client<Transport, Chain, Account>): JsonRpcSigner {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

export function useEthersSigner() {
  const { data: client } = useConnectorClient();
  return useMemo(
    () => (client ? clientToSigner(client) : undefined),
    [client]
  );
}
