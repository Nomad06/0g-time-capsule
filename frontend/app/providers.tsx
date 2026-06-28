"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { wagmiConfig } from "../lib/wagmi-config";
import { privyWagmiConfig, PRIVY_APP_ID } from "../lib/privy-config";
import { zeroGTestnet } from "../constants/contracts";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session — useState ensures it's not recreated on re-render
  const [queryClient] = useState(() => new QueryClient());

  // Normie-default path: email / social login with an auto-created embedded
  // wallet. Active only when an app id is configured; otherwise we keep the
  // original wallet-only stack so the app runs without extra setup.
  if (PRIVY_APP_ID) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          defaultChain: zeroGTestnet,
          supportedChains: [zeroGTestnet],
          // "wallet" keeps the advanced "connect my own wallet" path available
          // in the same login modal alongside email/google.
          loginMethods: ["email", "google", "wallet"],
          embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
          appearance: { theme: "dark", walletChainType: "ethereum-only" },
        }}
      >
        <QueryClientProvider client={queryClient}>
          {/* privyWagmiConfig is produced by Privy's own createConfig, so it is
              correct at runtime. Privy types the config's connectors as a loose
              array while the provider expects a non-empty tuple — a nominal
              generic mismatch only. Cast to the provider's own prop type. */}
          <PrivyWagmiProvider
            config={privyWagmiConfig as unknown as React.ComponentProps<typeof PrivyWagmiProvider>["config"]}
          >
            {children}
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
