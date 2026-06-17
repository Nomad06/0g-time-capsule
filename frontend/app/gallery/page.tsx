"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { CapsuleCard } from "@/components/CapsuleCard";
import { getPublicClient } from "@/lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "@/constants/contracts";
import { TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OnChainCapsule } from "@/lib/types";

type Tab = "all" | "mine" | "received";
type TriggerFilter = "all" | number;
interface CapsuleRow { id: `0x${string}`; capsule: OnChainCapsule; role: "owner" | "recipient" }

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const [rows,    setRows]    = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<Tab>("all");
  const [trigger, setTrigger] = useState<TriggerFilter>("all");

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    async function load() {
      try {
        const pub = getPublicClient();
        const [owned, received] = await Promise.all([
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getOwnerCapsules", args: [address!] }),
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getRecipientCapsules", args: [address!] }),
        ]) as [`0x${string}`[], `0x${string}`[]];

        const ownerSet = new Set(owned);
        const allIds   = [...new Set([...owned, ...received])];
        const capsules = await Promise.all(
          allIds.map(async (id) => {
            const cap = await pub.readContract({
              address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
              functionName: "getCapsule", args: [id],
            }) as OnChainCapsule;
            return { id, capsule: cap, role: (ownerSet.has(id) ? "owner" : "recipient") as "owner" | "recipient" };
          })
        );
        capsules.sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
        setRows(capsules);
      } catch (e: unknown) {
        toast.error("Failed to load capsules", { description: e instanceof Error ? e.message : String(e) });
      } finally { setLoading(false); }
    }
    load();
  }, [address, isConnected]);

  const counts = {
    all:      rows.length,
    mine:     rows.filter(r => r.role === "owner").length,
    received: rows.filter(r => r.role === "recipient").length,
  };

  const filtered = rows.filter(r => {
    if (tab === "mine"     && r.role !== "owner")     return false;
    if (tab === "received" && r.role !== "recipient") return false;
    if (trigger !== "all"  && r.capsule.triggerType !== trigger) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Capsules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sealed predictions, letters, and disclosures</p>
        </div>
        <Button asChild size="sm">
          <Link href="/seal"><Plus className="mr-1.5 h-4 w-4" />New</Link>
        </Button>
      </div>

      {!isConnected && (
        <div className="py-16 text-center">
          <p className="mb-5 text-muted-foreground">Connect wallet to view your capsules.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <>
          {/* Tabs */}
          <div className="mb-5 flex border-b border-border">
            {(["all", "mine", "received"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                <span className="text-muted-foreground/50 text-xs">({loading ? "…" : counts[t]})</span>
              </button>
            ))}
          </div>

          {/* Trigger filter */}
          {rows.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { value: "all" as TriggerFilter,        label: "All triggers" },
                { value: TriggerType.TIME as TriggerFilter,     label: "⏰ Time lock" },
                { value: TriggerType.DEADMAN as TriggerFilter,  label: "💀 Dead Man's" },
                { value: TriggerType.MULTISIG as TriggerFilter, label: "🗳️ Multi-Sig" },
              ].map(({ value, label }) => (
                <button
                  key={String(value)}
                  onClick={() => setTrigger(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    trigger === value
                      ? "border-indigo-700 bg-indigo-950 text-indigo-300"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && rows.length === 0 && (
            <div className="py-20 text-center">
              <div className="mb-4 text-5xl">⏳</div>
              <p className="mb-1 text-muted-foreground">No capsules yet.</p>
              <p className="mb-5 text-sm text-muted-foreground/60">Seal a prediction, letter, or secret — prove it later.</p>
              <Link href="/seal" className="text-sm text-indigo-400 hover:text-indigo-300">Create your first capsule →</Link>
            </div>
          )}

          {!loading && filtered.length === 0 && rows.length > 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No capsules match this filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {filtered.map(({ id, capsule }) => (
                <CapsuleCard key={id} id={id} capsule={capsule} myAddress={address} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
