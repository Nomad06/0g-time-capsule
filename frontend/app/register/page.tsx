"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "../../components/ConnectButton";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  loadPrivKeyFromStorage,
  hasSavedPrivKey,
} from "../../lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "../../lib/contract";

export default function RegisterPage() {
  const { isConnected, address } = useAccount();
  const [registered,   setRegistered]   = useState<boolean | null>(null);
  const [hasLocal,     setHasLocal]     = useState(false);
  const [status,       setStatus]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [txHash,       setTxHash]       = useState("");
  const [pubkeyHex,    setPubkeyHex]    = useState("");

  useEffect(() => {
    if (!address) return;
    setHasLocal(hasSavedPrivKey(address));
    hasEncryptionKey(address).then(setRegistered).catch(() => setRegistered(false));
  }, [address]);

  async function handleRegister() {
    if (!address) return;
    setLoading(true); setError(""); setStatus("Generating keypair…");
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      setHasLocal(true);

      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);

      setStatus("Sending registration tx…");
      const tx = await registerEncryptionKey(hex);
      setTxHash(tx);
      setRegistered(true);
      setStatus("Registered!");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); }
  }

  async function handleReRegister() {
    if (!address) return;
    setLoading(true); setError(""); setStatus("Generating new keypair…");
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);

      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);
      setStatus("Sending update tx…");
      const tx = await registerEncryptionKey(hex);
      setTxHash(tx);
      setRegistered(true);
      setStatus("Updated!");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); }
  }

  function handleExportKey() {
    if (!address) return;
    const privKey = loadPrivKeyFromStorage(address);
    if (!privKey) { setError("No local key found"); return; }
    const hex = Buffer.from(privKey).toString("hex");
    const blob = new Blob([hex], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `0g-capsule-key-${address.slice(0, 8)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  function handleImportKey(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    const reader = new FileReader();
    reader.onload = () => {
      const hex = (reader.result as string).trim();
      if (hex.length !== 64) { setError("Invalid key file (expected 32-byte hex)"); return; }
      const privKey = new Uint8Array(Buffer.from(hex, "hex"));
      savePrivKeyToStorage(address, privKey);
      setHasLocal(true);
      setStatus("Key imported from file.");
    };
    reader.readAsText(file);
  }

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Register Encryption Key</h1>
      <p style={{ color: "#888", marginBottom: 32, lineHeight: 1.6 }}>
        Generate a secp256k1 keypair in your browser. The private key stays in
        localStorage; the public key is registered on-chain so others can seal
        capsules specifically for you.
      </p>

      {!isConnected && <div style={{ marginBottom: 24 }}><ConnectButton /></div>}

      {isConnected && (
        <>
          {/* Status indicators */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <Badge ok={registered === true} label="On-chain key" />
            <Badge ok={hasLocal}            label="Local private key" />
          </div>

          {!registered && !hasLocal && (
            <div style={infoBox}>
              <p style={{ margin: 0, color: "#888", fontSize: 14, lineHeight: 1.7 }}>
                You haven&apos;t registered yet. Click below to generate a keypair and
                register your public key on-chain. The private key is saved to your
                browser — back it up afterward.
              </p>
            </div>
          )}

          {registered && !hasLocal && (
            <div style={{ ...infoBox, borderColor: "#78350f" }}>
              <p style={{ margin: 0, color: "#fb923c", fontSize: 14 }}>
                On-chain key found but no local private key. Import your backup or
                re-register (this will invalidate capsules encrypted to the old key).
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            {!registered && (
              <button onClick={handleRegister} disabled={loading} style={primaryBtn}>
                {loading ? status : "Generate & Register"}
              </button>
            )}
            {registered && (
              <button onClick={handleReRegister} disabled={loading} style={{ ...primaryBtn, background: "#374151" }}>
                {loading ? status : "Re-register (new key)"}
              </button>
            )}
            {hasLocal && (
              <button onClick={handleExportKey} style={ghostBtn}>
                Export private key
              </button>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ color: "#666", fontSize: 13 }}>
              Import private key from backup:{" "}
              <input type="file" accept=".txt" onChange={handleImportKey}
                style={{ color: "#888", fontSize: 13 }} />
            </label>
          </div>

          {txHash && (
            <div style={{ marginTop: 24, padding: 16, background: "#0a150a", border: "1px solid #14532d", borderRadius: 8 }}>
              <p style={{ color: "#4ade80", margin: "0 0 6px", fontWeight: "bold" }}>{status}</p>
              {pubkeyHex && (
                <p style={{ fontSize: 12, color: "#888", wordBreak: "break-all", margin: "0 0 6px" }}>
                  Public key: <code style={{ color: "#818cf8" }}>{pubkeyHex}</code>
                </p>
              )}
              <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
                Tx: <code style={{ wordBreak: "break-all" }}>{txHash}</code>
              </p>
              <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 10 }}>
                Back up your private key — if you clear localStorage you can no longer decrypt
                capsules sent to you.
              </p>
            </div>
          )}

          {status && !txHash && (
            <p style={{ color: "#818cf8", marginTop: 16, fontSize: 14 }}>{status}</p>
          )}
          {error && <p style={{ color: "#f87171", marginTop: 16, fontSize: 14 }}>{error}</p>}
        </>
      )}
    </main>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: "bold",
      background: ok ? "#052e16" : "#1a1a1a",
      color:      ok ? "#4ade80" : "#666",
      border:     `1px solid ${ok ? "#166534" : "#333"}`,
    }}>
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

const infoBox: React.CSSProperties = {
  padding: 16, background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 8, marginBottom: 8,
};

const primaryBtn: React.CSSProperties = {
  padding: "11px 24px", background: "#4f46e5", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "11px 24px", background: "transparent", color: "#888",
  border: "1px solid #333", borderRadius: 8, fontSize: 14, cursor: "pointer",
};
