"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { toast } from "sonner";
import { ConnectButton } from "../../../../components/ConnectButton";
import { Button } from "../../../../components/ui/button";
import { getSwitchInfo, checkin, triggerSwitch } from "../../../../lib/triggers";
import { revealOnChain } from "../../../../lib/contract";
import { cn } from "../../../../lib/utils";
import type { SwitchInfo } from "../../../../lib/types";

export default function DeadManPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const capsuleId = id as `0x${string}`;
  const { isConnected, address } = useAccount();

  const [info,    setInfo]    = useState<SwitchInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState("");
  const [now,     setNow]     = useState(BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    let cancel = false;
    async function poll() {
      try {
        const i = await getSwitchInfo(capsuleId);
        if (!cancel) setInfo(i);
      } catch { /* not armed yet */ }
    }
    poll();
    const t1 = setInterval(poll, 8000);
    const t2 = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => { cancel = true; clearInterval(t1); clearInterval(t2); };
  }, [capsuleId]);

  async function handleCheckin() {
    setLoading(true); setStatus("Sending check-in tx…");
    try {
      await checkin(capsuleId);
      setStatus("Check-in confirmed!");
      setInfo(await getSwitchInfo(capsuleId));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleTrigger() {
    setLoading(true); setStatus("Triggering switch…");
    try {
      await triggerSwitch(capsuleId);
      setStatus("Switch triggered — capsule is now revealable.");
      setInfo(await getSwitchInfo(capsuleId));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleReveal() {
    setLoading(true); setStatus("Sending reveal tx…");
    try {
      await revealOnChain(capsuleId);
      setStatus("Capsule revealed! Go to proof page to decrypt.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  const isOwner = info && address && info.owner.toLowerCase() === address.toLowerCase();
  const overdue = info ? (now >= info.deadline) : false;
  const canRevealNow = info?.triggered || overdue;
  const remaining = info ? Number(info.deadline - now) : 0;
  const daysLeft   = Math.max(0, Math.floor(remaining / 86400));
  const hoursLeft  = Math.max(0, Math.floor((remaining % 86400) / 3600));
  const minsLeft   = Math.max(0, Math.floor((remaining % 3600) / 60));

  return (
    <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="mb-6">
        <Link href={`/proof/${capsuleId}`} className="text-muted-foreground text-sm no-underline">
          ← Back to capsule
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1.5">Dead Man&apos;s Switch</h1>
      <p className="text-muted-foreground text-sm break-all mb-7">{capsuleId}</p>

      {!isConnected && <div className="mb-5"><ConnectButton /></div>}

      {!info && (
        <div className="rounded-xl border border-border bg-card p-5 mb-2">
          <p className="text-muted-foreground m-0">
            Switch not armed yet. Seal this capsule with the Dead Man&apos;s Switch trigger to activate.
          </p>
        </div>
      )}

      {info && (
        <>
          {/* Status card */}
          <div className={cn(
            "rounded-xl border p-5 mb-2",
            info.triggered ? "border-purple-900 bg-purple-950/20" :
            overdue        ? "border-amber-900 bg-amber-950/10"   :
                             "border-green-900 bg-green-950/10"
          )}>
            <div className="flex gap-2.5 items-center mb-3.5">
              <span className="text-[22px]">
                {info.triggered ? "💀" : overdue ? "⚠️" : "💚"}
              </span>
              <span className={`font-bold text-base ${
                info.triggered ? "text-fuchsia-400" : overdue ? "text-orange-400" : "text-green-400"
              }`}>
                {info.triggered ? "TRIGGERED" : overdue ? "OVERDUE — anyone can trigger" : "ALIVE"}
              </span>
            </div>

            <Row label="Owner"           value={info.owner} mono />
            <Row label="Interval"        value={`${Number(info.interval) / 86400} day(s)`} />
            <Row label="Last check-in"   value={new Date(Number(info.lastCheckin) * 1000).toLocaleString()} />
            <Row label="Next deadline"   value={new Date(Number(info.deadline) * 1000).toLocaleString()} />
            <Row label="Revealed"        value={info.revealed ? "Yes" : "No"} />

            {!info.triggered && !overdue && remaining > 0 && (
              <div className="mt-3.5 px-3.5 py-2.5 bg-card rounded-md">
                <p className="text-muted-foreground text-[11px] uppercase tracking-widest mb-2">
                  Time until deadline
                </p>
                <span className="text-[22px] font-bold text-indigo-300 tabular-nums">
                  {daysLeft}d {String(hoursLeft).padStart(2, "0")}h {String(minsLeft).padStart(2, "0")}m
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3 flex-wrap">
            {isConnected && isOwner && !info.triggered && (
              <Button onClick={handleCheckin} disabled={loading}>
                {loading && status.includes("check") ? status : "Check In"}
              </Button>
            )}
            {isConnected && overdue && !info.triggered && (
              <Button onClick={handleTrigger} disabled={loading} className="bg-purple-800 hover:bg-purple-700">
                {loading && status.includes("Trigger") ? status : "Trigger Switch"}
              </Button>
            )}
            {isConnected && canRevealNow && !info.revealed && (
              <Button onClick={handleReveal} disabled={loading} className="bg-green-900 hover:bg-green-800">
                {loading && status.includes("reveal") ? status : "Reveal Capsule"}
              </Button>
            )}
          </div>

          {status && <p className="text-green-400 mt-3 text-sm">{status}</p>}
        </>
      )}
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2.5 mb-2 text-sm">
      <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
      <span className={`break-all text-foreground/80 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
