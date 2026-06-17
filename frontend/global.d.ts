// EIP-1193 provider injected by MetaMask and compatible wallets
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
  };
}

// tlock-js has no bundled types
declare module "tlock-js" {
  import type { ChainClient } from "drand-client";
  export function timelockEncrypt(
    roundNumber: number,
    message: Buffer,
    client: ChainClient
  ): Promise<Buffer>;
  export function timelockDecrypt(
    ciphertext: Buffer,
    client: ChainClient
  ): Promise<Buffer>;
}
