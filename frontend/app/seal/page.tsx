"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { sealCapsule } from "../../lib/capsule";
import { getEncryptionKey } from "../../lib/contract";
import { ConnectButton } from "../../components/ConnectButton";
import type { SealResult, RecipientParam } from "../../lib/types";

export default function SealPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const [message,     setMessage]     = useState("");
  const [minutes,     setMinutes]     = useState(2);
  const [recipInput,  setRecipInput]  = useState("");  // comma-separated addresses
  const [result,      setResult]      = useState<SealResult | null>(null);
  const [status,      setStatus]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSeal() {
    if (!message.trim())  { setError("Message is empty"); return; }
    if (!isConnected)     { setError("Connect wallet first"); return; }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);

      // Parse recipients — resolve each to their registered pubkey
      const rawAddresses = recipInput
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      let recipients: RecipientParam[] = [];

      if (rawAddresses.length > 0) {
        setStatus("Fetching recipient encryption keys…");
        recipients = await Promise.all(
          rawAddresses.map(async (address) => {
            const pubkeyHex = await getEncryptionKey(address);
            if (!pubkeyHex || pubkeyHex === "0x") {
              throw new Error(`Recipient ${address} has not registered an encryption key. Ask them to visit /register first.`);
            }
            const pubkey = new Uint8Array(Buffer.from(pubkeyHex.slice(2), "hex"));
            return { address, pubkey };
          })
        );
      }

      setStatus("Encrypting + uploading to 0G…");
      const res = await sealCapsule({ plaintext: message, unlockTime, recipients });
      setResult(res);
      setStatus("Sealed!");
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

      {/* Recipients — Stage 2 */}
      <div style={{ marginTop: 20 }}>
        <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 6 }}>
          Recipients (optional — leave blank for public capsule)
        </label>
        <input
          type="text"
          placeholder="0xAbc…, 0xDef… (comma-separated wallet addresses)"
          value={recipInput}
          onChange={(e) => setRecipInput(e.target.value)}
          disabled={loading}
          style={inputStyle}
        />
        <p style={{ color: "#555", fontSize: 12, marginTop: 4 }}>
          Each address must have registered an encryption key at{" "}
          <a href="/register" style={{ color: "#818cf8" }}>/register</a>.
          Only designated recipients will be able to decrypt.
        </p>
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
            href={`/proof/${result.capsuleId}`}
            style={{ color: "#60a5fa", marginTop: 16, display: "block" }}
          >
            Go to proof page →
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
