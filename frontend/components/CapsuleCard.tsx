"use client";

import Link from "next/link";
import type { OnChainCapsule } from "../lib/types";

const TRIGGER_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  0: { label: "Time lock",        icon: "⏰", color: "#1e1b4b" },
  1: { label: "Dead Man's Switch", icon: "💀", color: "#422006" },
  2: { label: "Oracle",           icon: "🔮", color: "#172554" },
  3: { label: "Multi-Sig",        icon: "🗳️", color: "#1e1b4b" },
};

interface Props {
  id:         `0x${string}`;
  capsule:    OnChainCapsule;
  myAddress?: `0x${string}`;
}

export function CapsuleCard({ id, capsule, myAddress }: Props) {
  const revealed    = capsule.state === 1;
  const unlockDate  = new Date(Number(capsule.unlockTime) * 1000);
  const sealDate    = new Date(Number(capsule.createdAt) * 1000);
  const isOwner     = myAddress && capsule.owner.toLowerCase() === myAddress.toLowerCase();
  const isRecipient = myAddress && capsule.recipients.some(r => r.toLowerCase() === myAddress.toLowerCase());
  const now         = Date.now();
  const timeUnlocked = now >= unlockDate.getTime();
  const trigger     = TRIGGER_LABELS[capsule.triggerType] ?? TRIGGER_LABELS[0];

  // Compute countdown text
  const diff   = unlockDate.getTime() - now;
  const days   = Math.floor(diff / 86400000);
  const hours  = Math.floor((diff % 86400000) / 3600000);
  const countdownText =
    revealed   ? "Revealed"           :
    timeUnlocked ? "Ready to reveal"  :
    diff < 3600000 ? `${Math.floor(diff / 60000)}m left` :
    diff < 86400000 ? `${hours}h left` :
    `${days}d left`;

  const stateColor =
    revealed      ? "#4ade80" :
    timeUnlocked  ? "#fb923c" :
    "#a5b4fc";

  return (
    <Link href={`/proof/${id}`} style={{ textDecoration: "none" }}>
      <div style={cardBase(revealed, timeUnlocked)}>
        {/* Top row: badges + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge
              text={revealed ? "REVEALED" : "SEALED"}
              bg={revealed ? "#052e16" : "#1a1a2e"}
              color={revealed ? "#4ade80" : "#a5b4fc"}
              border={revealed ? "#166534" : "#3730a3"}
            />
            {!revealed && timeUnlocked && (
              <Badge text="UNLOCKED" bg="#422006" color="#fb923c" border="#78350f" />
            )}
            {isOwner     && <Badge text="MINE"      bg="#0d0d0d" color="#555" border="#2a2a2a" />}
            {isRecipient && <Badge text="RECIPIENT" bg="#0d0d0d" color="#818cf8" border="#2a2a2a" />}
          </div>
          <span style={{ color: "#444", fontSize: 11, flexShrink: 0, marginLeft: 8 }}>
            {sealDate.toLocaleDateString()}
          </span>
        </div>

        {/* ID */}
        <p style={{ margin: "0 0 12px", fontSize: 11, fontFamily: "monospace", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {id}
        </p>

        {/* Bottom row: trigger type + countdown */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 10px",
            borderRadius: 4,
            background: trigger.color,
            border: "1px solid #333",
            fontSize: 11,
            color: "#888",
          }}>
            <span>{trigger.icon}</span>
            <span>{trigger.label}</span>
          </div>
          <span style={{ color: stateColor, fontSize: 12, fontWeight: "bold" }}>
            {countdownText}
          </span>
        </div>

        {/* Recipient count hint */}
        {capsule.recipients.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#444" }}>
            {capsule.recipients.length} recipient{capsule.recipients.length > 1 ? "s" : ""} · ECIES-encrypted
          </div>
        )}
      </div>
    </Link>
  );
}

function Badge({ text, bg, color, border }: { text: string; bg: string; color: string; border: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: "bold", letterSpacing: 1,
      background: bg, color, border: `1px solid ${border}`,
    }}>
      {text}
    </span>
  );
}

function cardBase(revealed: boolean, unlocked: boolean): React.CSSProperties {
  const border =
    revealed ? "#166534" :
    unlocked ? "#78350f" :
    "#1e1e1e";
  return {
    padding: 18, background: "#0d0d0d",
    border: `1px solid ${border}`,
    borderRadius: 10, cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
  };
}
