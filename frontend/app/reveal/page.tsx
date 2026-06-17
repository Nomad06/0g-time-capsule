"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RevealIndexPage() {
  const [id, setId] = useState("");
  const router = useRouter();

  function go() {
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/reveal/${trimmed}`);
  }

  return (
    <main style={{ maxWidth: 540, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Open a Capsule</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>Enter a capsule ID to check its status.</p>

      <input
        placeholder="0x..."
        value={id}
        onChange={(e) => setId(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        style={{
          width: "100%",
          padding: "12px",
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 8,
          color: "#e5e5e5",
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={go}
        disabled={!id.trim()}
        style={{
          marginTop: 16,
          padding: "12px 32px",
          background: id.trim() ? "#4f46e5" : "#1a1a1a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          cursor: id.trim() ? "pointer" : "not-allowed",
        }}
      >
        Open
      </button>
    </main>
  );
}
