"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "../../components/ConnectButton";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  hasSavedPrivKey,
} from "../../lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "../../lib/contract";

const STEPS = [
  { id: 1, title: "Connect wallet",           desc: "Use MetaMask or any injected EVM wallet." },
  { id: 2, title: "Register encryption key",  desc: "Generate a keypair so others can send you capsules." },
  { id: 3, title: "Seal your first capsule",  desc: "Encrypt a message and lock it until the future." },
];

export default function OnboardPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();

  const [step,       setStep]       = useState(1);
  const [regDone,    setRegDone]    = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError,   setRegError]   = useState("");
  const [regTx,      setRegTx]      = useState("");

  useEffect(() => {
    if (isConnected && step === 1) setStep(2);
  }, [isConnected, step]);

  useEffect(() => {
    if (!address) return;
    const local = hasSavedPrivKey(address);
    hasEncryptionKey(address).then(on => {
      if (local && on) { setRegDone(true); if (step === 2) setStep(3); }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function handleRegister() {
    if (!address) return;
    setRegLoading(true); setRegError("");
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      const tx  = await registerEncryptionKey(hex);
      setRegTx(tx);
      setRegDone(true);
      setStep(3);
    } catch (e: unknown) {
      setRegError(e instanceof Error ? e.message : String(e));
    } finally { setRegLoading(false); }
  }

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Get started</h1>
      <p style={{ color: "#666", marginBottom: 36 }}>
        Three steps to seal your first time capsule.
      </p>

      {/* Step progress */}
      <div style={{ display: "flex", gap: 0, marginBottom: 40, alignItems: "center" }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: "bold",
              background: step > s.id ? "#166534" : step === s.id ? "#4f46e5" : "#1a1a1a",
              color:      step > s.id ? "#4ade80"  : step === s.id ? "#fff"     : "#555",
              border: `1px solid ${step > s.id ? "#166534" : step === s.id ? "#4f46e5" : "#333"}`,
            }}>
              {step > s.id ? "✓" : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.id + 1 ? "#166534" : "#1a1a1a", margin: "0 6px" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Connect */}
      <StepCard active={step === 1} done={step > 1} step={STEPS[0]}>
        {step === 1 && (
          <div style={{ marginTop: 16 }}>
            <ConnectButton />
          </div>
        )}
        {step > 1 && (
          <p style={{ color: "#4ade80", fontSize: 13, marginTop: 8 }}>
            Connected: <code>{address?.slice(0, 10)}…{address?.slice(-6)}</code>
          </p>
        )}
      </StepCard>

      {/* Step 2: Register key */}
      <StepCard active={step === 2} done={step > 2} step={STEPS[1]}>
        {step === 2 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              A secp256k1 keypair is generated in your browser. Private key stays local;
              public key is registered on-chain so senders can encrypt specifically for you.
            </p>
            <button onClick={handleRegister} disabled={regLoading} style={primaryBtn}>
              {regLoading ? "Registering…" : "Generate & Register"}
            </button>
            {regError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{regError}</p>}
            <p style={{ color: "#555", fontSize: 12, marginTop: 12 }}>
              Skip if you&apos;ve already registered at{" "}
              <Link href="/register" style={{ color: "#818cf8" }}>/register</Link>.
              This step is optional — required only for receiving encrypted capsules.
            </p>
          </div>
        )}
        {step > 2 && (
          <p style={{ color: "#4ade80", fontSize: 13, marginTop: 8 }}>
            Key registered.{" "}
            {regTx && <code style={{ fontSize: 11 }}>{regTx.slice(0, 18)}…</code>}
          </p>
        )}
      </StepCard>

      {/* Step 3: Seal */}
      <StepCard active={step === 3} done={false} step={STEPS[2]}>
        {step === 3 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              You&apos;re ready. Choose a trigger type, write your message, and seal it on-chain.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/seal")} style={primaryBtn}>
                Create my first capsule →
              </button>
              <Link href="/gallery" style={ghostLink}>View gallery</Link>
            </div>
          </div>
        )}
      </StepCard>
    </main>
  );
}

function StepCard({
  active, done, step: s, children
}: {
  active: boolean; done: boolean;
  step: { id: number; title: string; desc: string };
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: 20, marginBottom: 12,
      background: active ? "#0d0d14" : "#0a0a0a",
      border: `1px solid ${active ? "#3730a3" : done ? "#166534" : "#1a1a1a"}`,
      borderRadius: 10,
      opacity: !active && !done ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, color: done ? "#4ade80" : active ? "#e5e5e5" : "#666" }}>
            {s.title}
          </h3>
          <p style={{ margin: 0, color: "#555", fontSize: 13 }}>{s.desc}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 22px", background: "#4f46e5", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer",
};

const ghostLink: React.CSSProperties = {
  padding: "10px 22px", background: "transparent", color: "#888",
  border: "1px solid #333", borderRadius: 8, fontSize: 14,
  textDecoration: "none", display: "inline-block",
};
