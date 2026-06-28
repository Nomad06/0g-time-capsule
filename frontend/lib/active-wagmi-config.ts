import { wagmiConfig } from "./wagmi-config";
import { privyWagmiConfig, PRIVY_APP_ID } from "./privy-config";

// Single source of truth for which wagmi config is actually wired to the
// provider tree in `providers.tsx`. @wagmi/core actions (getWalletClient, etc.)
// must be called with the SAME config the provider uses, or they won't see the
// connected account. When Privy is enabled the live config is Privy's; otherwise
// it's the plain wallet config.
export const activeWagmiConfig = PRIVY_APP_ID ? privyWagmiConfig : wagmiConfig;
