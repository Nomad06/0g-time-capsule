"use client";

import { useState, useEffect } from "react";

interface Props {
  unlockDate: Date;
  isUnlocked: boolean;
}

export function CountdownClock({ unlockDate, isUnlocked }: Props) {
  const [remaining, setRemaining] = useState(unlockDate.getTime() - Date.now());

  useEffect(() => {
    if (isUnlocked) return;
    const t = setInterval(() => setRemaining(unlockDate.getTime() - Date.now()), 500);
    return () => clearInterval(t);
  }, [unlockDate, isUnlocked]);

  if (isUnlocked) {
    return (
      <div style={wrapStyle("#14532d", "#166534")}>
        <span style={{ fontSize: 22, marginRight: 10 }}>🔓</span>
        <span style={{ color: "#4ade80", fontWeight: "bold", fontSize: 16 }}>Capsule is now unlocked</span>
      </div>
    );
  }

  const total = Math.max(0, remaining);
  const d     = Math.floor(total / 86400000);
  const h     = Math.floor((total % 86400000) / 3600000);
  const m     = Math.floor((total % 3600000) / 60000);
  const s     = Math.floor((total % 60000) / 1000);

  return (
    <div style={wrapStyle("#0f0f1a", "#1e1b4b")}>
      <p style={{ color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
        Unlocks in
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        {d > 0 && <Unit n={d} label="days" />}
        <Unit n={h} label="hours" />
        <Unit n={m} label="min" />
        <Unit n={s} label="sec" />
      </div>
      <p style={{ color: "#444", fontSize: 12, margin: "12px 0 0" }}>
        {unlockDate.toLocaleString()}
      </p>
    </div>
  );
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 48 }}>
      <div style={{ fontSize: 32, fontWeight: "bold", color: "#a5b4fc", fontVariantNumeric: "tabular-nums" }}>
        {String(n).padStart(2, "0")}
      </div>
      <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

function wrapStyle(bg: string, border: string): React.CSSProperties {
  return {
    padding: 24, background: bg, border: `1px solid ${border}`,
    borderRadius: 10, textAlign: "center",
  };
}
