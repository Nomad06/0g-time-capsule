import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { zeroGTestnet } from "../constants/contracts";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [zeroGTestnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "0G Time Capsule" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
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
