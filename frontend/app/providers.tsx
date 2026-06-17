"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "../lib/wagmi-config";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session — useState ensures it's not recreated on re-render
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
