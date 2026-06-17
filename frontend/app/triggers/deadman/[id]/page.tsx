"use client";

import { useState, useEffect, use } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ConnectButton } from "../../../../components/ConnectButton";
import { getSwitchInfo, checkin, triggerSwitch } from "../../../../lib/triggers";
import { revealOnChain } from "../../../../lib/contract";
import type { SwitchInfo } from "../../../../lib/types";

export default function DeadManPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const capsuleId = id as `0x${string}`;
  const { isConnected, address } = useAccount();

  const [info,    setInfo]    = useState<SwitchInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState("");
  const [error,   setError]   = useState("");
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
    setLoading(true); setError(""); setStatus("Sending check-in tx…");
    try {
      await checkin(capsuleId);
      setStatus("Check-in confirmed!");
      setInfo(await getSwitchInfo(capsuleId));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  async function handleTrigger() {
    setLoading(true); setError(""); setStatus("Triggering switch…");
    try {
      await triggerSwitch(capsuleId);
      setStatus("Switch triggered — capsule is now revealable.");
      setInfo(await getSwitchInfo(capsuleId));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  async function handleReveal() {
    setLoading(true); setError(""); setStatus("Sending reveal tx…");
    try {
      await revealOnChain(capsuleId);
      setStatus("Capsule revealed! Go to proof page to decrypt.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  const isOwner = info && address && info.owner.toLowerCase() === address.toLowerCase();
  const overdue = info ? (now >= info.deadline) : false;
  const canRevealNow = info?.triggered || overdue;
  const remaining = info ? Number(info.deadline - now) : 0;
  const daysLeft   = Math.max(0, Math.floor(remaining / 86400));
  const hoursLeft  = Math.max(0, Math.floor((remaining % 86400) / 3600));
  const minsLeft   = Math.max(0, Math.floor((remaining % 3600) / 60));

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href={`/proof/${capsuleId}`} style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>
          ← Back to capsule
        </Link>
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Dead Man&apos;s Switch</h1>
      <p style={{ color: "#666", fontSize: 13, wordBreak: "break-all", marginBottom: 28 }}>{capsuleId}</p>

      {!isConnected && <div style={{ marginBottom: 20 }}><ConnectButton /></div>}

      {!info && (
        <div style={infoBox}>
          <p style={{ color: "#666", margin: 0 }}>
            Switch not armed yet. Seal this capsule with the Dead Man&apos;s Switch trigger to activate.
          </p>
        </div>
      )}

      {info && (
        <>
          {/* Status card */}
          <div style={{
            ...infoBox,
            borderColor: info.triggered ? "#7e22ce" : overdue ? "#78350f" : "#166534",
            background: info.triggered ? "#0d0620" : overdue ? "#0d0800" : "#050f05",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>
                {info.triggered ? "💀" : overdue ? "⚠️" : "💚"}
              </span>
              <span style={{
                fontWeight: "bold", fontSize: 16,
                color: info.triggered ? "#e879f9" : overdue ? "#fb923c" : "#4ade80",
              }}>
                {info.triggered ? "TRIGGERED" : overdue ? "OVERDUE — anyone can trigger" : "ALIVE"}
              </span>
            </div>

            <Row label="Owner"           value={info.owner} mono />
            <Row label="Interval"        value={`${Number(info.interval) / 86400} day(s)`} />
            <Row label="Last check-in"   value={new Date(Number(info.lastCheckin) * 1000).toLocaleString()} />
            <Row label="Next deadline"   value={new Date(Number(info.deadline) * 1000).toLocaleString()} />
            <Row label="Revealed"        value={info.revealed ? "Yes" : "No"} />

            {!info.triggered && !overdue && remaining > 0 && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#0a0a14", borderRadius: 6 }}>
                <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>
                  Time until deadline
                </p>
                <span style={{ fontSize: 22, fontWeight: "bold", color: "#a5b4fc", fontVariantNumeric: "tabular-nums" }}>
                  {daysLeft}d {String(hoursLeft).padStart(2, "0")}h {String(minsLeft).padStart(2, "0")}m
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {isConnected && isOwner && !info.triggered && (
              <button onClick={handleCheckin} disabled={loading} style={primaryBtn}>
                {loading && status.includes("check") ? status : "Check In"}
              </button>
            )}
            {isConnected && overdue && !info.triggered && (
              <button onClick={handleTrigger} disabled={loading}
                style={{ ...primaryBtn, background: "#7e22ce" }}>
                {loading && status.includes("Trigger") ? status : "Trigger Switch"}
              </button>
            )}
            {isConnected && canRevealNow && !info.revealed && (
              <button onClick={handleReveal} disabled={loading}
                style={{ ...primaryBtn, background: "#166534" }}>
                {loading && status.includes("reveal") ? status : "Reveal Capsule"}
              </button>
            )}
          </div>

          {status && <p style={{ color: "#4ade80", marginTop: 12, fontSize: 14 }}>{status}</p>}
          {error  && <p style={{ color: "#f87171", marginTop: 12, fontSize: 14 }}>{error}</p>}
        </>
      )}
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: "#666", minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", color: "#ccc" }}>
        {value}
      </span>
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 20, background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 10, marginBottom: 8,
};

const primaryBtn: React.CSSProperties = {
  padding: "11px 24px", background: "#4f46e5", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer",
};
