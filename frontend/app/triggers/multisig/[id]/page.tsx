"use client";

import { useState, useEffect, use } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ConnectButton } from "../../../../components/ConnectButton";
import { getVaultInfo, approveReveal, hasApproved, multisigCanReveal } from "../../../../lib/triggers";
import { revealOnChain } from "../../../../lib/contract";
import type { VaultInfo } from "../../../../lib/types";

export default function MultiSigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const capsuleId = id as `0x${string}`;
  const { isConnected, address } = useAccount();

  const [vault,      setVault]      = useState<VaultInfo | null>(null);
  const [approved,   setApproved]   = useState(false);
  const [canReveal,  setCanReveal]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [status,     setStatus]     = useState("");
  const [error,      setError]      = useState("");

  async function load() {
    const v = await getVaultInfo(capsuleId);
    setVault(v);
    if (v && address) {
      const [app, cr] = await Promise.all([
        hasApproved(capsuleId, address as `0x${string}`),
        multisigCanReveal(capsuleId),
      ]);
      setApproved(app);
      setCanReveal(cr);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsuleId, address]);

  async function handleApprove() {
    setLoading(true); setError(""); setStatus("Sending approval tx…");
    try {
      await approveReveal(capsuleId);
      setStatus("Approval confirmed!");
      await load();
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

  const isSigner  = vault && address && vault.signers.some(s => s.toLowerCase() === address?.toLowerCase());
  const progress  = vault ? vault.approvalCount / vault.threshold : 0;

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href={`/proof/${capsuleId}`} style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>
          ← Back to capsule
        </Link>
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Multi-Sig Reveal</h1>
      <p style={{ color: "#666", fontSize: 13, wordBreak: "break-all", marginBottom: 28 }}>{capsuleId}</p>

      {!isConnected && <div style={{ marginBottom: 20 }}><ConnectButton /></div>}

      {!vault && (
        <div style={infoBox}>
          <p style={{ color: "#666", margin: 0 }}>
            No vault found for this capsule. Seal with Multi-sig trigger to create one.
          </p>
        </div>
      )}

      {vault && (
        <>
          <div style={{
            ...infoBox,
            borderColor: canReveal ? "#166534" : "#1e1b4b",
            background:  canReveal ? "#050f05" : "#0a0a14",
          }}>
            <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>
              Vault status
            </p>

            <Row label="Owner"     value={vault.owner} mono />
            <Row label="Threshold" value={`${vault.threshold} of ${vault.signers.length} signers`} />
            <Row label="Approvals" value={`${vault.approvalCount} / ${vault.threshold}`} />
            <Row label="Revealed"  value={vault.revealed ? "Yes" : "No"} />

            {/* Progress bar */}
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{
                height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${Math.min(100, progress * 100)}%`,
                  background: canReveal ? "#4ade80" : "#4f46e5",
                  transition: "width 0.4s",
                  borderRadius: 4,
                }} />
              </div>
              <p style={{ color: canReveal ? "#4ade80" : "#666", fontSize: 12, margin: "6px 0 0" }}>
                {canReveal ? "Threshold reached — ready to reveal" : `${vault.threshold - vault.approvalCount} more approval(s) needed`}
              </p>
            </div>

            {/* Signer list */}
            <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>
              Signers
            </p>
            {vault.signers.map((s, i) => (
              <SignerRow
                key={s}
                index={i + 1}
                address={s}
                isYou={s.toLowerCase() === address?.toLowerCase()}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {isConnected && isSigner && !approved && !vault.revealed && (
              <button onClick={handleApprove} disabled={loading} style={primaryBtn}>
                {loading && status.includes("Approv") ? status : "Approve Reveal"}
              </button>
            )}
            {approved && !vault.revealed && (
              <span style={{ padding: "11px 0", color: "#4ade80", fontSize: 14 }}>
                ✓ You have approved
              </span>
            )}
            {isConnected && canReveal && !vault.revealed && (
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

function SignerRow({ index, address, isYou }: { index: number; address: string; isYou: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: "#444", minWidth: 20 }}>{index}.</span>
      <code style={{ color: isYou ? "#a5b4fc" : "#888", wordBreak: "break-all" }}>{address}</code>
      {isYou && <span style={{ color: "#a5b4fc", fontSize: 11 }}>(you)</span>}
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
