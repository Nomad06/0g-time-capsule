import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { zeroGTestnet } from "../constants/contracts";

// WalletConnect lets mobile-browser users connect a phone wallet via QR /
// deep-link. Injected only works inside an in-app wallet browser or a desktop
// extension, so without this mobile Safari/Chrome has no usable connector.
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [zeroGTestnet],
  connectors: [
    injected(),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: "0G Time Capsule",
              description: "Seal an encrypted message on-chain until a future unlock.",
              url: "https://0g-time-capsule.app",
              icons: ["https://0g-time-capsule.app/icon.png"],
            },
          }),
        ]
      : []),
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
