import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { zeroGTestnet } from "../constants/contracts";

// Privy gives average users an email / Google / Apple login with an auto-created
// embedded wallet — no MetaMask, no faucet. It coexists with the plain-wagmi
// flow: when NEXT_PUBLIC_PRIVY_APP_ID is unset the app falls back to the
// wallet-only path in `providers.tsx`, so nothing breaks without configuration.
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Privy manages its own connectors (embedded + external wallets), so this config
// only declares the chain + transport. wagmi hooks (useAccount, useWriteContract)
// work unchanged on top of Privy's active wallet.
export const privyWagmiConfig = createConfig({
  chains: [zeroGTestnet],
  transports: {
    [zeroGTestnet.id]: http(
      process.env.NEXT_PUBLIC_0G_RPC_URL ?? "https://evmrpc-testnet.0g.ai"
    ),
  },
});
