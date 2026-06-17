"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getCapsule } from "@/lib/contract";
import { getAllCapsuleEvents } from "@/lib/events";
import { Address } from "@/components/Address";
import { CountdownClock } from "@/components/CountdownClock";
import { cn } from "@/lib/utils";
import type { OnChainCapsule } from "@/lib/types";

const TRIGGER_LABELS: Record<number, string> = {
  0: "⏰ Time lock",
  1: "💀 Dead Man's Switch",
  2: "🔮 Oracle",
  3: "🗳️ Multi-Sig",
};

type Tab = "soon" | "revealed" | "all";

interface CapsuleRow {
  id:      `0x${string}`;
  capsule: OnChainCapsule;
}

export default function DiscoverPage() {
  const [rows,    setRows]    = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<Tab>("soon");

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        setLoading(true);
        const events = await getAllCapsuleEvents(200);
        const capsules = await Promise.allSettled(
          events.map(e => getCapsule(e.capsuleId).then(c => ({ id: e.capsuleId, capsule: c })))
        );
        if (cancel) return;
        const resolved = capsules
          .filter((r): r is PromiseFulfilledResult<CapsuleRow> => r.status === "fulfilled")
          .map(r => r.value);
        setRows(resolved);
      } catch (e: unknown) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  const now = Date.now() / 1000;

  const filtered = useMemo(() => {
    if (tab === "soon") {
      return rows
        .filter(r => r.capsule.state === 0 && Number(r.capsule.unlockTime) > now)
        .sort((a, b) => Number(a.capsule.unlockTime) - Number(b.capsule.unlockTime));
    }
    if (tab === "revealed") {
      return rows
        .filter(r => r.capsule.state === 1)
        .sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
    }
    return rows.sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
  }, [rows, tab, now]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "soon",     label: "Unlocking Soon" },
    { key: "revealed", label: "Revealed" },
    { key: "all",      label: "All" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold">Discover Capsules</h1>
        <p className="text-sm text-muted-foreground">
          Public record of all time capsules sealed on 0G Chain. No wallet needed.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-indigo-950/60 text-indigo-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* State */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No capsules here yet.</p>
          <Link href="/seal" className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            Seal the first one →
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ id, capsule }) => (
            <CapsuleCard key={id} id={id} capsule={capsule} />
          ))}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <p className="mt-8 text-xs text-muted-foreground/40 text-center">
          {rows.length} capsule{rows.length !== 1 ? "s" : ""} indexed from 0G Chain · data from on-chain events
        </p>
      )}
    </main>
  );
}

function CapsuleCard({ id, capsule }: { id: `0x${string}`; capsule: OnChainCapsule }) {
  const revealed    = capsule.state === 1;
  const unlockDate  = new Date(Number(capsule.unlockTime) * 1000);
  const triggerLabel = TRIGGER_LABELS[capsule.triggerType] ?? "Unknown";

  return (
    <Link
      href={`/proof/${id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-indigo-900 hover:bg-indigo-950/10"
    >
      {/* Status + trigger */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "rounded px-2 py-0.5 text-[10px] font-bold tracking-widest border",
          revealed
            ? "border-green-800 bg-green-950 text-green-400"
            : "border-indigo-800 bg-indigo-950 text-indigo-300"
        )}>
          {revealed ? "REVEALED" : "SEALED"}
        </span>
        <span className="text-xs text-muted-foreground/60">{triggerLabel}</span>
      </div>

      {/* Owner */}
      <div className="text-xs text-muted-foreground">
        by <Address address={capsule.owner} className="font-mono text-foreground/70" />
      </div>

      {/* Countdown or reveal date */}
      {!revealed ? (
        <div className="mt-auto">
          <CountdownClock unlockDate={unlockDate} isUnlocked={false} compact />
        </div>
      ) : (
        <p className="mt-auto text-xs text-green-400/70">
          Revealed · {unlockDate.toLocaleDateString()}
        </p>
      )}

      {/* ID */}
      <p className="font-mono text-[9px] text-muted-foreground/30 break-all">
        {id.slice(0, 20)}…
      </p>
    </Link>
  );
}
