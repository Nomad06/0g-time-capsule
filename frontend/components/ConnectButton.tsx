"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { zeroGTestnet } from "../constants/contracts";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const onWrongChain = isConnected && chainId !== zeroGTestnet.id;

  if (onWrongChain) {
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

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:block">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
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
