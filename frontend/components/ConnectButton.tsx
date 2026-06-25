"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { zeroGTestnet } from "../constants/contracts";
import { PRIVY_APP_ID } from "../lib/privy-config";

// PRIVY_APP_ID is a build-time constant, so this branch is stable across every
// render — picking the variant here never violates the rules of hooks.
export function ConnectButton() {
  return PRIVY_APP_ID ? <PrivyConnect /> : <WagmiConnect />;
}

// Wrong-network pill shared by both variants.
function SwitchChainButton() {
  const { switchChain } = useSwitchChain();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => switchChain({ chainId: zeroGTestnet.id })}
      className="border-amber-800 text-amber-400 hover:bg-amber-950 hover:text-amber-300"
    >
      Switch to 0G Testnet
    </Button>
  );
}

function AccountPill({ address, onDisconnect }: { address?: string; onDisconnect: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:block">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <Button variant="outline" size="sm" onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

// ── Normie-default: Privy email / social login + embedded wallet ──────────────
// The Privy modal also exposes "connect a wallet", so the advanced path lives in
// the same button — no separate UI needed.
function PrivyConnect() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, chainId } = useAccount();

  if (!ready) {
    return (
      <Button size="sm" disabled>
        <Wallet className="mr-1.5 h-3.5 w-3.5" />
        Loading…
      </Button>
    );
  }

  if (!authenticated) {
    return (
      <Button size="sm" onClick={login}>
        <Wallet className="mr-1.5 h-3.5 w-3.5" />
        Sign in
      </Button>
    );
  }

  // External wallets may sit on the wrong chain; the embedded wallet defaults to 0G.
  if (chainId !== undefined && chainId !== zeroGTestnet.id) {
    return <SwitchChainButton />;
  }

  return <AccountPill address={address} onDisconnect={logout} />;
}

// ── Advanced-only fallback: original wallet-connector flow ────────────────────
// Used when no Privy app id is configured.
function WagmiConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && chainId !== zeroGTestnet.id) {
    return <SwitchChainButton />;
  }

  if (isConnected) {
    return <AccountPill address={address} onDisconnect={() => disconnect()} />;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isPending}>
          <Wallet className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Connecting…" : "Connect"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Select wallet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => { connect({ connector: c }); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {c.icon && (
                <img src={c.icon} alt="" className="h-6 w-6 rounded" />
              )}
              {c.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
