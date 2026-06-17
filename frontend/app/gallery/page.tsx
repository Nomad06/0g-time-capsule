"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getPublicClient } from "../../lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "../../constants/contracts";
import { ConnectButton } from "../../components/ConnectButton";
import type { OnChainCapsule } from "../../lib/types";

interface CapsuleRow {
  id:        `0x${string}`;
  capsule:   OnChainCapsule;
}

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const [rows,    setRows]    = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError("");

    async function load() {
      try {
        const pub = getPublicClient();

        // Fetch owned + received capsule IDs in parallel
        const [owned, received] = await Promise.all([
          pub.readContract({
            address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
            functionName: "getOwnerCapsules", args: [address!],
          }),
          pub.readContract({
            address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
            functionName: "getRecipientCapsules", args: [address!],
          }),
        ]) as [`0x${string}`[], `0x${string}`[]];

        const allIds = [...new Set([...owned, ...received])];

        const capsules = await Promise.all(
          allIds.map(async (id) => {
            const cap = await pub.readContract({
              address: CONTRACT_ADDRESSES.TimeCapsule, abi: TIME_CAPSULE_ABI,
              functionName: "getCapsule", args: [id],
            }) as OnChainCapsule;
            return { id, capsule: cap };
          })
        );

        // Sort: newest first
        capsules.sort((a, b) => Number(b.capsule.createdAt) - Number(a.capsule.createdAt));
        setRows(capsules);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [address, isConnected]);

  return (
    <main style={{ maxWidth: 760, margin: "60px auto", padding: "0 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
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

      {isConnected && loading && (
        <p style={{ color: "#555", textAlign: "center", padding: "40px 0" }}>Loading…</p>
      )}

      {isConnected && !loading && error && (
        <p style={{ color: "#f87171" }}>{error}</p>
      )}

      {isConnected && !loading && !error && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: "#555", marginBottom: 20 }}>No capsules yet.</p>
          <Link href="/seal" style={{ color: "#818cf8", fontSize: 14 }}>Create your first capsule →</Link>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(({ id, capsule }) => (
            <CapsuleCard key={id} id={id} capsule={capsule} myAddress={address} />
          ))}
        </div>
      )}
    </main>
  );
}

function CapsuleCard({ id, capsule, myAddress }: { id: `0x${string}`; capsule: OnChainCapsule; myAddress?: `0x${string}` }) {
  const revealed    = capsule.state === 1;
  const unlockDate  = new Date(Number(capsule.unlockTime) * 1000);
  const sealDate    = new Date(Number(capsule.createdAt) * 1000);
  const isOwner     = myAddress && capsule.owner.toLowerCase() === myAddress.toLowerCase();
  const now         = Date.now();
  const isUnlocked  = now >= unlockDate.getTime();

  return (
    <Link href={`/proof/${id}`} style={{ textDecoration: "none" }}>
      <div style={cardStyle(revealed)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Badge text={revealed ? "REVEALED" : "SEALED"}  bg={revealed ? "#14532d" : "#1e1b4b"} color={revealed ? "#4ade80" : "#a5b4fc"} border={revealed ? "#166534" : "#3730a3"} />
              {!revealed && isUnlocked && <Badge text="UNLOCKED" bg="#422006" color="#fb923c" border="#78350f" />}
              {isOwner && <Badge text="MINE" bg="#1a1a1a" color="#666" border="#333" />}
            </div>
            <p style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {id}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
              Sealed {sealDate.toLocaleDateString()}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: revealed ? "#4ade80" : isUnlocked ? "#fb923c" : "#666" }}>
              {revealed ? "Revealed" : isUnlocked ? "Ready to reveal" : `Unlocks ${unlockDate.toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a1a1a" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#444", fontFamily: "monospace" }}>
            commit: {capsule.commitHash.slice(0, 20)}…
          </p>
        </div>
      </div>
    </Link>
  );
}

function Badge({ text, bg, color, border }: { text: string; bg: string; color: string; border: string }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: "bold", letterSpacing: 1, background: bg, color, border: `1px solid ${border}` }}>
      {text}
    </span>
  );
}

function cardStyle(revealed: boolean): React.CSSProperties {
  return {
    padding: 18, background: "#0d0d0d",
    border: `1px solid ${revealed ? "#166534" : "#222"}`,
    borderRadius: 10,
    cursor: "pointer",
    transition: "border-color 0.15s",
  };
}

const newBtn: React.CSSProperties = {
  padding: "10px 20px", background: "#4f46e5", color: "#fff",
  textDecoration: "none", borderRadius: 8, fontSize: 14,
};
