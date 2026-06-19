"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllCapsuleEvents } from "@/lib/events";
import { getCapsule } from "@/lib/contract";
import type { CapsuleSummary } from "@/lib/events";
import type { OnChainCapsule } from "@/lib/types";

const TRIGGER_LABELS: Record<number, string> = {
  0: "⏰ Time lock",
  1: "💀 Dead Man's Switch",
  2: "🔮 Oracle",
  3: "🗳️ Multi-Sig",
};

interface Stats {
  total:        number;
  sealed:       number;
  revealed:     number;
  byTrigger:    Record<number, number>;
  unlockingSoon: number; // within 24h
  medianLockDays: number;
}

function computeStats(events: CapsuleSummary[], capsules: OnChainCapsule[]): Stats {
  const now = Date.now() / 1000;
  const h24 = now + 86400;

  const byTrigger: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let sealed = 0, revealed = 0, unlockingSoon = 0;
  const lockDays: number[] = [];

  events.forEach(e => { byTrigger[e.triggerType] = (byTrigger[e.triggerType] ?? 0) + 1; });

  capsules.forEach((c, i) => {
    if (c.state === 0) {
      sealed++;
      const unlock = Number(c.unlockTime);
      if (unlock > now && unlock <= h24) unlockingSoon++;
    } else {
      revealed++;
    }
    const created = Number(events[i]?.unlockTime ?? 0);
    const lock    = Number(c.unlockTime);
    if (created && lock > created) {
      lockDays.push((lock - created) / 86400);
    }
  });

  lockDays.sort((a, b) => a - b);
  const median = lockDays.length ? lockDays[Math.floor(lockDays.length / 2)] : 0;

  return { total: events.length, sealed, revealed, byTrigger, unlockingSoon, medianLockDays: Math.round(median) };
}

export default function StatsPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const events = await getAllCapsuleEvents(500);
        const capsules = await Promise.all(
          events.map(e => getCapsule(e.capsuleId).catch(() => null))
        );
        const valid = capsules.filter(Boolean) as OnChainCapsule[];
        if (!cancel) setStats(computeStats(events, valid));
      } catch (e: unknown) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold">Protocol Stats</h1>
        <p className="text-sm text-muted-foreground">
          Live data from 0G Chain · all capsules indexed from on-chain events
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {stats && (
        <>
          {/* Top metrics */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Sealed" value={stats.total} icon="🔒" />
            <StatCard label="Revealed"     value={stats.revealed} icon="🔓" accent="green" />
            <StatCard label="Unlocking in 24h" value={stats.unlockingSoon} icon="⏳" accent="amber" />
            <StatCard label="Median lock" value={`${stats.medianLockDays}d`} icon="📅" raw />
          </div>

          {/* Trigger breakdown */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Trigger Type Breakdown
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.byTrigger)
                .filter(([, n]) => n > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">{TRIGGER_LABELS[Number(type)]}</span>
                        <span className="font-mono text-foreground/70">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* State breakdown */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              State Breakdown
            </h2>
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-indigo-700 text-2xl font-bold text-indigo-300"
                  style={{ boxShadow: "0 0 20px rgba(99,102,241,.2)" }}
                >
                  {stats.total > 0 ? Math.round((stats.sealed / stats.total) * 100) : 0}%
                </div>
                <span className="text-xs text-muted-foreground">Sealed</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-green-700 text-2xl font-bold text-green-400"
                  style={{ boxShadow: "0 0 20px rgba(34,197,94,.15)" }}
                >
                  {stats.total > 0 ? Math.round((stats.revealed / stats.total) * 100) : 0}%
                </div>
                <span className="text-xs text-muted-foreground">Revealed</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <Link href="/discover" className="text-indigo-400 hover:text-indigo-300">Browse all capsules →</Link>
            <Link href="/seal"     className="text-muted-foreground hover:text-foreground">Seal a new one →</Link>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({
  label, value, icon, accent = "indigo", raw = false,
}: {
  label: string;
  value: number | string;
  icon:  string;
  accent?: "indigo" | "green" | "amber";
  raw?: boolean;
}) {
  const colors = {
    indigo: "text-indigo-300",
    green:  "text-green-400",
    amber:  "text-amber-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 text-xl">{icon}</div>
      <div className={`text-2xl font-bold tabular-nums ${colors[accent]}`}>
        {raw ? value : Number(value).toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
