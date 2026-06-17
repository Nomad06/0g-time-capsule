"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { sealCapsule } from "../../lib/capsule";
import { getEncryptionKey } from "../../lib/contract";
import { ConnectButton } from "../../components/ConnectButton";
import { TriggerType } from "../../lib/types";
import type { SealResult, RecipientParam } from "../../lib/types";

export default function SealPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [message,     setMessage]     = useState("");
  const [minutes,     setMinutes]     = useState(2);
  const [recipInput,  setRecipInput]  = useState("");
  const [triggerType, setTriggerType] = useState<import("../../lib/types").TriggerType>(TriggerType.TIME);
  // DeadManSwitch config
  const [dmsInterval, setDmsInterval] = useState(1);  // days
  // MultiSig config
  const [msSigners,   setMsSigners]   = useState("");  // comma-separated
  const [msThreshold, setMsThreshold] = useState(2);

  const [result,  setResult]  = useState<SealResult | null>(null);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSeal() {
    if (!message.trim()) { setError("Message is empty"); return; }
    if (!isConnected)    { setError("Connect wallet first"); return; }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);

      // Parse recipients
      const rawAddresses = recipInput
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      let recipients: RecipientParam[] = [];
      if (rawAddresses.length > 0) {
        setStatus("Fetching recipient encryption keys…");
        recipients = await Promise.all(
          rawAddresses.map(async (addr) => {
            const pubkeyHex = await getEncryptionKey(addr);
            if (!pubkeyHex || pubkeyHex === "0x") {
              throw new Error(`${addr} has not registered an encryption key.`);
            }
            return { address: addr, pubkey: new Uint8Array(Buffer.from(pubkeyHex.slice(2), "hex")) };
          })
        );
      }

      // Parse multisig signers
      const multisigSigners = msSigners
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      setStatus(triggerType === TriggerType.TIME
        ? "Encrypting + uploading to 0G…"
        : triggerType === TriggerType.DEADMAN
          ? "Sealing + arming dead man's switch…"
          : "Sealing + creating multi-sig vault…"
      );

      const res = await sealCapsule({
        plaintext:  message,
        unlockTime,
        recipients,
        triggerType,
        triggerContract: triggerType === TriggerType.DEADMAN
          ? undefined  // resolved from CONTRACT_ADDRESSES in lib
          : triggerType === TriggerType.MULTISIG
            ? undefined
            : undefined,
        deadman:  triggerType === TriggerType.DEADMAN ? { intervalDays: dmsInterval } : undefined,
        multisig: triggerType === TriggerType.MULTISIG
          ? { signers: multisigSigners, threshold: msThreshold }
          : undefined,
      });

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
        Encrypted on-chain. Decryptable only when the unlock condition is met.
      </p>

      {!isConnected && <div style={{ marginBottom: 24 }}><ConnectButton /></div>}

      <textarea
        rows={5}
        placeholder="Write your message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
        style={inputStyle}
      />

      {/* Trigger type selector */}
      <div style={{ marginTop: 20 }}>
        <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 8 }}>
          Unlock trigger
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { value: TriggerType.TIME,    label: "Time lock",       desc: "Unlocks at a set time" },
            { value: TriggerType.DEADMAN, label: "Dead Man's Switch", desc: "Unlocks if owner stops checking in" },
            { value: TriggerType.MULTISIG, label: "Multi-sig",       desc: "Unlocks when M-of-N signers approve" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTriggerType(opt.value)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: `1px solid ${triggerType === opt.value ? "#4f46e5" : "#333"}`,
                background: triggerType === opt.value ? "#1e1b4b" : "#111",
                color: triggerType === opt.value ? "#a5b4fc" : "#666",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 2 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time lock: unlock time */}
      {triggerType === TriggerType.TIME && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
          <label style={{ color: "#888" }}>Unlock in</label>
          <input
            type="number" min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            disabled={loading}
            style={{ ...inputStyle, width: 80 }}
          />
          <span style={{ color: "#888" }}>minutes</span>
        </div>
      )}

      {/* Dead man's switch config */}
      {triggerType === TriggerType.DEADMAN && (
        <div style={configBox}>
          <p style={configLabel}>Dead Man&apos;s Switch configuration</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <label style={{ color: "#888", fontSize: 13 }}>Check-in interval</label>
            <input
              type="number" min={1}
              value={dmsInterval}
              onChange={(e) => setDmsInterval(Number(e.target.value))}
              disabled={loading}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: "#888", fontSize: 13 }}>days</span>
          </div>
          <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
            You must call &quot;check in&quot; at least once every {dmsInterval} day(s) or the capsule unlocks automatically.
            Anyone can trigger the reveal once overdue.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ color: "#888", fontSize: 13 }}>Seal time (block-based fallback)</label>
            <input
              type="number" min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: "#888", fontSize: 13 }}>min (min unlock window)</span>
          </div>
        </div>
      )}

      {/* Multi-sig config */}
      {triggerType === TriggerType.MULTISIG && (
        <div style={configBox}>
          <p style={configLabel}>Multi-sig configuration</p>
          <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 4 }}>
            Signers (comma-separated addresses)
          </label>
          <textarea
            rows={3}
            placeholder="0xAbc…, 0xDef…"
            value={msSigners}
            onChange={(e) => setMsSigners(e.target.value)}
            disabled={loading}
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <label style={{ color: "#888", fontSize: 13 }}>Threshold</label>
            <input
              type="number" min={1}
              value={msThreshold}
              onChange={(e) => setMsThreshold(Number(e.target.value))}
              disabled={loading}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: "#888", fontSize: 13 }}>
              of {msSigners.split(/[\s,]+/).filter(s => s.startsWith("0x") && s.length === 42).length} signers
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ color: "#888", fontSize: 13 }}>Min time (block fallback)</label>
            <input
              type="number" min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: "#888", fontSize: 13 }}>min</span>
          </div>
        </div>
      )}

      {/* Recipients — Stage 2 */}
      <div style={{ marginTop: 20 }}>
        <label style={{ color: "#888", fontSize: 13, display: "block", marginBottom: 6 }}>
          Recipients (optional)
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
          <a href={`/proof/${result.capsuleId}`} style={{ color: "#60a5fa", marginTop: 16, display: "block" }}>
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
  width: "100%", padding: "12px", background: "#1a1a1a",
  border: "1px solid #333", borderRadius: 8, color: "#e5e5e5",
  fontSize: 14, boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  marginTop: 24, padding: "12px 32px", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 16,
};

const resultBox: React.CSSProperties = {
  marginTop: 32, padding: 20, background: "#111",
  border: "1px solid #2a2a2a", borderRadius: 8,
};

const configBox: React.CSSProperties = {
  marginTop: 16, padding: 16, background: "#0d0d0d",
  border: "1px solid #1e1e1e", borderRadius: 8,
};

const configLabel: React.CSSProperties = {
  color: "#666", fontSize: 11, textTransform: "uppercase",
  letterSpacing: 1, margin: "0 0 12px",
};
