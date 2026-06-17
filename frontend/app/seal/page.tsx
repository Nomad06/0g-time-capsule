"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { sealCapsule } from "../../lib/capsule";
import { ConnectButton } from "../../components/ConnectButton";
import type { SealResult } from "../../lib/types";

export default function SealPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const [message,  setMessage]  = useState("");
  const [minutes,  setMinutes]  = useState(2);
  const [result,   setResult]   = useState<SealResult | null>(null);
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSeal() {
    if (!message.trim())  { setError("Message is empty"); return; }
    if (!isConnected)     { setError("Connect wallet first"); return; }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);

      setStatus("Encrypting + uploading to 0G…");
      const res = await sealCapsule({ plaintext: message, unlockTime });
      setResult(res);
      setStatus("Sealed!");
      // Redirect to proof page after 1.5s
      setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Seal a Capsule</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>
        Encrypted on-chain. Decryptable only after the unlock time.
      </p>

      {!isConnected && (
        <div style={{ marginBottom: 24 }}>
          <ConnectButton />
        </div>
      )}

      <textarea
        rows={5}
        placeholder="Write your message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
        style={inputStyle}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
        <label style={{ color: "#888" }}>Unlock in</label>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          disabled={loading}
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ color: "#888" }}>minutes</span>
      </div>

      <button
        onClick={handleSeal}
        disabled={loading || !isConnected}
        style={{
          ...btnBase,
          background: isConnected ? "#4f46e5" : "#1a1a1a",
          cursor: isConnected ? "pointer" : "not-allowed",
        }}
      >
        {loading ? status || "Working…" : "Seal Capsule"}
      </button>

      {error && <p style={{ color: "#f87171", marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={resultBox}>
          <p style={{ color: "#4ade80", marginBottom: 12 }}>Capsule sealed!</p>
          <Field label="Capsule ID"   value={result.capsuleId} />
          <Field label="Storage Root" value={result.storageRoot} />
          <Field label="Commit Hash"  value={result.commitHash} />
          <Field label="Drand Round"  value={String(result.drandRound)} />
          <Field label="Tx Hash"      value={result.txHash} />
          <a
            href={`/reveal/${result.capsuleId}`}
            style={{ color: "#60a5fa", marginTop: 16, display: "block" }}
          >
            Go to reveal page →
          </a>
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ color: "#888", fontSize: 12 }}>{label}: </span>
      <span style={{ fontSize: 12, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#e5e5e5",
  fontSize: 14,
  boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  marginTop: 24,
  padding: "12px 32px",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 16,
};

const resultBox: React.CSSProperties = {
  marginTop: 32,
  padding: 20,
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
};
