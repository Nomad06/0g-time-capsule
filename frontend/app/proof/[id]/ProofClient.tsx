"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider } from "ethers";
import Link from "next/link";
import { getCapsule, isUnlocked } from "../../../lib/contract";
import { revealCapsule, decryptRevealed, decryptAsRecipient } from "../../../lib/capsule";
import { loadPrivKeyFromStorage, hasSavedPrivKey } from "../../../lib/ecies";
import { HashVerifyAnimation } from "../../../components/HashVerifyAnimation";
import { CountdownClock } from "../../../components/CountdownClock";
import type { OnChainCapsule, RevealResult } from "../../../lib/types";

interface Props {
  capsuleId: `0x${string}`;
}

export function ProofClient({ capsuleId }: Props) {
  const { isConnected, address } = useAccount();
  const [capsule,  setCapsule]  = useState<OnChainCapsule | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [result,   setResult]   = useState<RevealResult | null>(null);
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState(false);

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
      setStatus("Sign to decrypt…");
      setResult(await revealCapsule(capsuleId, signer));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleDecrypt() {
    setLoading(true); setError(""); setStatus("Sign to decrypt…");
    try {
      const signer = await getSigner();
      setResult(await decryptRevealed(capsuleId, signer));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleRecipientDecrypt() {
    if (!address) return;
    setLoading(true); setError(""); setStatus("Decrypting with your local key…");
    try {
      const privKey = loadPrivKeyFromStorage(address);
      if (!privKey) throw new Error("No local encryption key found. Visit /register to import or regenerate.");
      setResult(await decryptAsRecipient(capsuleId, address, privKey));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isOwner        = capsule && address && capsule.owner.toLowerCase() === address.toLowerCase();
  const isRecipient    = capsule && address &&
    capsule.recipients.some(r => r.toLowerCase() === address?.toLowerCase());
  const hasLocalKey    = address ? hasSavedPrivKey(address) : false;
  const alreadyRevealed = capsule?.state === 1;
  const unlockDate      = capsule ? new Date(Number(capsule.unlockTime) * 1000) : null;
  const sealDate        = capsule ? new Date(Number(capsule.createdAt) * 1000) : null;

  return (
    <main style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: "bold", letterSpacing: 1,
              background: alreadyRevealed ? "#14532d" : "#1e1b4b",
              color:      alreadyRevealed ? "#4ade80"  : "#a5b4fc",
              border:     `1px solid ${alreadyRevealed ? "#166534" : "#3730a3"}`,
            }}>
              {alreadyRevealed ? "REVEALED" : "SEALED"}
            </span>
            {unlocked && !alreadyRevealed && (
              <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, background: "#422006", color: "#fb923c", border: "1px solid #78350f" }}>
                UNLOCKED
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 26, margin: 0 }}>Time Capsule</h1>
          <p style={{ color: "#555", fontSize: 12, margin: "4px 0 0", wordBreak: "break-all" }}>{capsuleId}</p>
        </div>
        <button onClick={copyLink} style={ghostBtn}>
          {copied ? "✓ Copied" : "Share link"}
        </button>
      </div>

      {/* Proof block — visible to ANYONE, no wallet needed */}
      {capsule && (
        <div style={proofBox}>
          <p style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>
            On-chain commitment
          </p>
          <ProofRow label="Sealed"       value={sealDate?.toLocaleString() ?? "—"} />
          <ProofRow label="Unlocks"      value={unlockDate?.toLocaleString() ?? "—"} />
          <ProofRow label="Commit hash"  value={capsule.commitHash} mono highlight />
          <ProofRow label="Storage root" value={capsule.storageRoot} mono />
          <ProofRow label="Owner"        value={capsule.owner} mono />

          <p style={{ color: "#555", fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            The commit hash is <strong style={{ color: "#888" }}>keccak256(plaintext)</strong> stored on 0G Chain at seal time.
            When revealed, anyone can verify the content matches — proving it was written before the seal date.
          </p>
        </div>
      )}

      {/* Countdown (shown while sealed) */}
      {capsule && !alreadyRevealed && unlockDate && (
        <div style={{ margin: "32px 0" }}>
          <CountdownClock unlockDate={unlockDate} isUnlocked={unlocked} />
        </div>
      )}

      {/* Actions */}
      {!result && capsule && (
        <div style={{ margin: "24px 0" }}>
          {!isConnected && !alreadyRevealed && (
            <p style={{ color: "#666", fontSize: 14 }}>Connect wallet to reveal (if you&apos;re the owner).</p>
          )}

          {isConnected && unlocked && !alreadyRevealed && (
            <button onClick={handleReveal} disabled={loading} style={primaryBtn}>
              {loading ? status : "Reveal & Decrypt"}
            </button>
          )}

          {alreadyRevealed && isConnected && isOwner && (
            <button onClick={handleDecrypt} disabled={loading} style={{ ...primaryBtn, background: "#166534" }}>
              {loading ? status : "Decrypt (sign to read)"}
            </button>
          )}

          {/* Stage 2: recipient decrypt — no signing needed, uses local ECIES key */}
          {alreadyRevealed && isConnected && isRecipient && !isOwner && (
            <div>
              <button
                onClick={handleRecipientDecrypt}
                disabled={loading || !hasLocalKey}
                style={{ ...primaryBtn, background: hasLocalKey ? "#1d4ed8" : "#1a1a1a" }}
              >
                {loading ? status : "Decrypt as recipient"}
              </button>
              {!hasLocalKey && (
                <p style={{ color: "#f59e0b", fontSize: 12, marginTop: 6 }}>
                  No local encryption key found.{" "}
                  <a href="/register" style={{ color: "#818cf8" }}>Register or import your key →</a>
                </p>
              )}
            </div>
          )}

          {alreadyRevealed && !isConnected && (
            <p style={{ color: "#666", fontSize: 14 }}>
              Capsule revealed. Connect wallet to decrypt.
            </p>
          )}
        </div>
      )}

      {error && <p style={{ color: "#f87171", marginTop: 12, fontSize: 14 }}>{error}</p>}

      {/* Reveal result with animation */}
      {result && (
        <HashVerifyAnimation
          plaintext={result.plaintext}
          commitHash={capsule?.commitHash ?? result.commitHash}
          revealedHash={result.commitHash}
          verified={result.verified}
          sealDate={sealDate}
        />
      )}

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #1a1a1a" }}>
        <Link href="/gallery" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>← All capsules</Link>
        {" · "}
        <Link href="/seal" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>Create your own</Link>
      </div>
    </main>
  );
}

function ProofRow({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start", fontSize: 13 }}>
      <span style={{ color: "#666", minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontFamily:  mono ? "monospace" : "inherit",
        wordBreak:   "break-all",
        color:       highlight ? "#818cf8" : "#ccc",
        fontWeight:  highlight ? "bold" : "normal",
      }}>
        {value}
      </span>
    </div>
  );
}

const proofBox: React.CSSProperties = {
  padding: 24, background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 10, marginBottom: 8,
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 14px", background: "transparent", color: "#666",
  border: "1px solid #333", borderRadius: 6, fontSize: 12, cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 32px", background: "#4f46e5", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer",
};
