"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider } from "ethers";
import { getCapsule, isUnlocked } from "../../../lib/contract";
import { revealCapsule, decryptRevealed } from "../../../lib/capsule";
import { ConnectButton } from "../../../components/ConnectButton";
import type { OnChainCapsule, RevealResult } from "../../../lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RevealPage({ params }: Props) {
  const { id } = use(params);
  const capsuleId = id as `0x${string}`;

  const { isConnected } = useAccount();
  const [capsule,  setCapsule]  = useState<OnChainCapsule | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [result,   setResult]   = useState<RevealResult | null>(null);
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Poll capsule state every 5 s
  useEffect(() => {
    let cancel = false;
    async function poll() {
      try {
        const [cap, open] = await Promise.all([getCapsule(capsuleId), isUnlocked(capsuleId)]);
        if (!cancel) { setCapsule(cap); setUnlocked(open); }
      } catch (e: unknown) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancel = true; clearInterval(t); };
  }, [capsuleId]);

  async function getSigner() {
    if (!window.ethereum) throw new Error("No wallet detected");
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }

  async function handleReveal() {
    setLoading(true); setError(""); setStatus("Sending reveal tx…");
    try {
      const signer = await getSigner();
      setStatus("Sign message to decrypt…");
      const res = await revealCapsule(capsuleId, signer);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleDecryptAlreadyRevealed() {
    setLoading(true); setError(""); setStatus("Sign message to decrypt…");
    try {
      const signer = await getSigner();
      const res = await decryptRevealed(capsuleId, signer);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  const unlockDate     = capsule ? new Date(Number(capsule.unlockTime) * 1000) : null;
  const alreadyRevealed = capsule?.state === 1;

  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Reveal Capsule</h1>
      <p style={{ color: "#555", fontSize: 12, wordBreak: "break-all", marginBottom: 24 }}>{capsuleId}</p>

      {capsule && (
        <div style={metaBox}>
          <Row label="Owner"       value={capsule.owner} />
          <Row label="Unlock time" value={unlockDate?.toLocaleString() ?? "—"} />
          <Row label="Status"      value={
            alreadyRevealed ? "Revealed" : unlocked ? "Unlocked" : "Locked"
          } />
          <Row label="Commit hash" value={capsule.commitHash} />
        </div>
      )}

      {!isConnected && <div style={{ marginBottom: 20 }}><ConnectButton /></div>}

      {!result && (
        <div style={{ display: "flex", gap: 12 }}>
          {!alreadyRevealed && (
            <button
              onClick={handleReveal}
              disabled={loading || !unlocked || !isConnected}
              style={{
                ...btnBase,
                background: (unlocked && isConnected) ? "#4f46e5" : "#1a1a1a",
                cursor:     (unlocked && isConnected) ? "pointer"  : "not-allowed",
              }}
            >
              {loading
                ? status
                : !isConnected  ? "Connect wallet"
                : !unlocked     ? `Locked until ${unlockDate?.toLocaleTimeString() ?? "…"}`
                : "Reveal & Decrypt"}
            </button>
          )}
          {alreadyRevealed && isConnected && (
            <button onClick={handleDecryptAlreadyRevealed} disabled={loading} style={{ ...btnBase, background: "#166534" }}>
              {loading ? status : "Decrypt (sign to read)"}
            </button>
          )}
        </div>
      )}

      {error && <p style={{ color: "#f87171", marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={revealBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>{result.verified ? "✓" : "⚠"}</span>
            <span style={{ color: result.verified ? "#4ade80" : "#fbbf24", fontSize: 14 }}>
              {result.verified
                ? "Verified — content matches on-chain commitment"
                : "WARNING: content hash mismatch"}
            </span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15 }}>{result.plaintext}</p>
          <hr style={{ borderColor: "#1a3a1a", margin: "16px 0" }} />
          <small style={{ color: "#555" }}>Commit hash: {result.commitHash}</small>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: "#666", minWidth: 90 }}>{label}</span>
      <span style={{ wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const metaBox: React.CSSProperties = {
  padding: 20, background: "#111", border: "1px solid #222", borderRadius: 8, marginBottom: 24,
};
const revealBox: React.CSSProperties = {
  marginTop: 32, padding: 24, background: "#0a1a0a", border: "1px solid #166534", borderRadius: 8,
};
const btnBase: React.CSSProperties = {
  padding: "12px 28px", color: "#fff", border: "none", borderRadius: 8, fontSize: 15,
};
