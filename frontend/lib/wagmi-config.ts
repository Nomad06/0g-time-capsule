import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { zeroGTestnet } from "../constants/contracts";

export const wagmiConfig = createConfig({
  chains: [zeroGTestnet],
  connectors: [
    injected(),
  ],
  transports: {
    [zeroGTestnet.id]: http(
      process.env.NEXT_PUBLIC_0G_RPC_URL ?? "https://evmrpc-testnet.0g.ai"
    ),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
