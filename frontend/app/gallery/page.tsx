"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getPublicClient } from "../../lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "../../constants/contracts";
import { ConnectButton } from "../../components/ConnectButton";
import { CapsuleCard } from "../../components/CapsuleCard";
import { TriggerType } from "../../lib/types";
import type { OnChainCapsule } from "../../lib/types";

type Tab = "all" | "mine" | "received";
type TriggerFilter = "all" | number;

interface CapsuleRow { id: `0x${string}`; capsule: OnChainCapsule; role: "owner" | "recipient" }

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const [rows,    setRows]    = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<Tab>("all");
  const [trigger, setTrigger] = useState<TriggerFilter>("all");

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true); setError("");

    async function load() {
      try {
        const pub = getPublicClient();
        const [owned, received] = await Promise.all([
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getOwnerCapsules", args: [address!] }),
          pub.readContract({ address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI, functionName: "getRecipientCapsules", args: [address!] }),
        ]) as [`0x${string}`[], `0x${string}`[]];

        const ownerSet    = new Set(owned);
        const recipientSet = new Set(received);
        const allIds      = [...new Set([...owned, ...received])];

        const capsules = await Promise.all(
          allIds.map(async (id) => {
            const cap = await pub.readContract({
              address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
              functionName: "getCapsule", args: [id],
            }) as OnChainCapsule;
            const role: "owner" | "recipient" = ownerSet.has(id) ? "owner" : "recipient";
            return { id, capsule: cap, role };
          })
        );

        capsules.sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
        setRows(capsules);
      } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setLoading(false); }
    }

    load();
  }, [address, isConnected]);

  // Filter
  const filtered = rows.filter(r => {
    if (tab === "mine"     && r.role !== "owner")     return false;
    if (tab === "received" && r.role !== "recipient") return false;
    if (trigger !== "all"  && r.capsule.triggerType !== trigger) return false;
    return true;
  });

  const counts = {
    all:      rows.length,
    mine:     rows.filter(r => r.role === "owner").length,
    received: rows.filter(r => r.role === "recipient").length,
  };

  return (
    <main style={{ maxWidth: 800, margin: "60px auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>My Capsules</h1>
          <p style={{ color: "#555", margin: "4px 0 0", fontSize: 14 }}>
            Sealed predictions, letters, and disclosures
          </p>
        </div>
        <Link href="/seal" style={newBtn}>+ New Capsule</Link>
      </div>

      {!isConnected && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: "#555", marginBottom: 20 }}>Connect wallet to view your capsules.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && !loading && (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #1a1a1a" }}>
            {(["all", "mine", "received"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                <span style={{ color: "#444", fontSize: 11 }}>({counts[t]})</span>
              </button>
            ))}
          </div>

          {/* Trigger filter */}
          {rows.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <FilterChip active={trigger === "all"} onClick={() => setTrigger("all")} label="All triggers" />
              <FilterChip active={trigger === TriggerType.TIME}    onClick={() => setTrigger(TriggerType.TIME)}    label="⏰ Time lock" />
              <FilterChip active={trigger === TriggerType.DEADMAN} onClick={() => setTrigger(TriggerType.DEADMAN)} label="💀 Dead Man's" />
              <FilterChip active={trigger === TriggerType.MULTISIG} onClick={() => setTrigger(TriggerType.MULTISIG)} label="🗳️ Multi-Sig" />
            </div>
          )}

          {error && <p style={{ color: "#f87171" }}>{error}</p>}

          {!error && filtered.length === 0 && rows.length === 0 && (
            <EmptyState />
          )}

          {!error && filtered.length === 0 && rows.length > 0 && (
            <p style={{ color: "#555", textAlign: "center", padding: "32px 0", fontSize: 14 }}>
              No capsules match this filter.
            </p>
          )}

          {filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(({ id, capsule }) => (
                <CapsuleCard key={id} id={id} capsule={capsule} myAddress={address} />
              ))}
            </div>
          )}
        </>
      )}

      {isConnected && loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <p style={{ color: "#555", marginBottom: 8 }}>No capsules yet.</p>
      <p style={{ color: "#444", fontSize: 13, marginBottom: 20 }}>
        Seal a prediction, letter, or secret — prove it later.
      </p>
      <Link href="/seal" style={{ color: "#818cf8", fontSize: 14 }}>Create your first capsule →</Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      padding: 18, border: "1px solid #1a1a1a",
      borderRadius: 10, height: 96,
      background: "linear-gradient(90deg, #0d0d0d 25%, #111 50%, #0d0d0d 75%)",
      backgroundSize: "200% 100%",
    } as React.CSSProperties} />
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
      background: active ? "#1e1b4b" : "transparent",
      color:      active ? "#a5b4fc"  : "#555",
      border:     `1px solid ${active ? "#3730a3" : "#2a2a2a"}`,
    }}>
      {label}
    </button>
  );
}

const newBtn: React.CSSProperties = {
  padding: "10px 20px", background: "#4f46e5", color: "#fff",
  textDecoration: "none", borderRadius: 8, fontSize: 14,
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px", background: "transparent", cursor: "pointer",
    color:      active ? "#e5e5e5" : "#555",
    border:     "none",
    borderBottom: `2px solid ${active ? "#4f46e5" : "transparent"}`,
    fontSize: 14,
  };
}
