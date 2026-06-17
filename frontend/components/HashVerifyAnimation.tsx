"use client";

import { useState, useEffect } from "react";

interface Props {
  plaintext:   string;
  commitHash:  string;   // sealed on-chain
  revealedHash: string;  // keccak256(revealed plaintext)
  verified:    boolean;
  sealDate:    Date | null;
}

export function HashVerifyAnimation({ plaintext, commitHash, revealedHash, verified, sealDate }: Props) {
  const [phase, setPhase] = useState<"hashing" | "comparing" | "done">("hashing");
  const [hashVisible, setHashVisible]   = useState("");
  const [showContent, setShowContent]   = useState(false);

  // Scramble → reveal animation for the hash
  useEffect(() => {
    const target = revealedHash;
    const chars  = "0123456789abcdef";
    let tick = 0;
    const total = 40; // frames

    const id = setInterval(() => {
      tick++;
      const progress = tick / total;
      const revealed = Math.floor(progress * target.length);
      const scramble = Array.from({ length: target.length - revealed }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      setHashVisible(target.slice(0, revealed) + scramble);

      if (tick >= total) {
        clearInterval(id);
        setHashVisible(target);
        setTimeout(() => setPhase("comparing"), 300);
        setTimeout(() => setPhase("done"), 900);
        setTimeout(() => setShowContent(true), 1100);
      }
    }, 30);

    return () => clearInterval(id);
  }, [revealedHash]);

  return (
    <div style={{ marginTop: 32 }}>

      {/* Hash reveal animation */}
      <div style={hashBox}>
        <p style={label}>Computing keccak256(revealed content)…</p>
        <code style={{ fontSize: 13, wordBreak: "break-all", color: "#818cf8", letterSpacing: 1 }}>
          {hashVisible || commitHash}
        </code>

        {phase !== "hashing" && (
          <div style={{ marginTop: 16 }}>
            <p style={label}>Comparing with on-chain commitment…</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontFamily: "monospace" }}>
              <HashRow label="Sealed hash  " value={commitHash}  />
              <HashRow label="Revealed hash" value={revealedHash} />
            </div>

            {phase === "done" && (
              <div style={{
                marginTop: 14, padding: "10px 16px",
                background: verified ? "#052e16" : "#3b0764",
                border: `1px solid ${verified ? "#166534" : "#7e22ce"}`,
                borderRadius: 6, display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{verified ? "✓" : "✗"}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: "bold", color: verified ? "#4ade80" : "#e879f9", fontSize: 14 }}>
                    {verified ? "MATCH — content is authentic" : "MISMATCH — content may be tampered"}
                  </p>
                  {verified && sealDate && (
                    <p style={{ margin: "2px 0 0", color: "#555", fontSize: 12 }}>
                      Proved: this exact text existed on {sealDate.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revealed content */}
      {showContent && (
        <div style={{
          marginTop: 24, padding: 28,
          background: "#050f05",
          border: "1px solid #14532d",
          borderRadius: 10,
          animation: "fadeIn 0.6s ease",
        }}>
          <p style={{ ...label, marginBottom: 12 }}>Revealed content</p>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 16, color: "#e5e5e5", margin: 0 }}>
            {plaintext}
          </p>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function HashRow({ label: l, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "#555", minWidth: 120, flexShrink: 0 }}>{l}</span>
      <span style={{ color: "#818cf8", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const hashBox: React.CSSProperties = {
  padding: 20, background: "#0a0a14", border: "1px solid #1e1b4b", borderRadius: 10,
};

const label: React.CSSProperties = {
  color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px",
};
