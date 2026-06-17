import { ImageResponse } from "next/og";
import { getPublicClient } from "../../../lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "../../../constants/contracts";

export const runtime = "nodejs";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props { params: Promise<{ id: string }> }

export default async function OgImage({ params }: Props) {
  const { id } = await params;

  // Fetch on-chain data
  let state    = "SEALED";
  let sealDate = "Unknown";
  let unlockDate = "Unknown";
  let commitHash = "0x…";

  try {
    const pub = getPublicClient();
    const cap = await pub.readContract({
      address:      CONTRACT_ADDRESSES.TimeCapsule,
      abi:          TIME_CAPSULE_ABI,
      functionName: "getCapsule",
      args:         [id as `0x${string}`],
    }) as { state: number; createdAt: bigint; unlockTime: bigint; commitHash: `0x${string}` };

    state      = cap.state === 1 ? "REVEALED" : "SEALED";
    sealDate   = new Date(Number(cap.createdAt) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    unlockDate = new Date(Number(cap.unlockTime) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    commitHash = cap.commitHash.slice(0, 20) + "…";
  } catch { /* capsule not found or RPC error — use defaults */ }

  const isRevealed = state === "REVEALED";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          fontFamily: "monospace",
          position: "relative",
        }}
      >
        {/* Background grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.4,
        }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, position: "relative" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#4f46e5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>⏳</div>
          <span style={{ color: "#555", fontSize: 16, letterSpacing: 2 }}>0G TIME CAPSULE</span>
        </div>

        {/* State badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 28,
          position: "relative",
        }}>
          <div style={{
            padding: "6px 18px",
            borderRadius: 6,
            background: isRevealed ? "#052e16" : "#1e1b4b",
            border: `1px solid ${isRevealed ? "#166534" : "#3730a3"}`,
            color: isRevealed ? "#4ade80" : "#a5b4fc",
            fontSize: 14,
            fontWeight: "bold",
            letterSpacing: 2,
          }}>
            {state}
          </div>
        </div>

        {/* Title */}
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 52, fontWeight: "bold", color: "#e5e5e5", marginBottom: 24, lineHeight: 1.2 }}>
            {isRevealed ? "Capsule revealed" : "Capsule sealed"}
          </div>
          <div style={{ fontSize: 22, color: "#555", marginBottom: 40 }}>
            {isRevealed
              ? `Sealed ${sealDate} · content verified on-chain`
              : `Sealed ${sealDate} · unlocks ${unlockDate}`
            }
          </div>
        </div>

        {/* Commit hash */}
        <div style={{
          position: "relative",
          padding: "20px 24px",
          background: "#050505",
          border: "1px solid #1e1e1e",
          borderRadius: 10,
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 8 }}>ON-CHAIN COMMITMENT</div>
          <div style={{ fontSize: 18, color: "#818cf8", fontFamily: "monospace" }}>{commitHash}</div>
        </div>

        {/* Footer */}
        <div style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #1a1a1a",
          paddingTop: 20,
        }}>
          <div style={{ fontSize: 13, color: "#333" }}>
            {id.slice(0, 14)}…{id.slice(-10)}
          </div>
          <div style={{ fontSize: 13, color: "#333", letterSpacing: 1 }}>
            0G CHAIN · 0G STORAGE · AES-256-GCM
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
