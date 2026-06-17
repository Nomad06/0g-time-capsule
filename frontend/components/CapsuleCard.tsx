"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OnChainCapsule } from "../lib/types";

const TRIGGER_META: Record<number, { label: string; icon: string; className: string }> = {
  0: { label: "Time lock",         icon: "⏰", className: "border-indigo-900 bg-indigo-950/50 text-indigo-400" },
  1: { label: "Dead Man's Switch", icon: "💀", className: "border-amber-900 bg-amber-950/50 text-amber-400" },
  2: { label: "Oracle",            icon: "🔮", className: "border-blue-900 bg-blue-950/50 text-blue-400" },
  3: { label: "Multi-Sig",         icon: "🗳️", className: "border-indigo-900 bg-indigo-950/50 text-indigo-400" },
};

interface Props {
  id:         `0x${string}`;
  capsule:    OnChainCapsule;
  myAddress?: `0x${string}`;
}

export function CapsuleCard({ id, capsule, myAddress }: Props) {
  const revealed     = capsule.state === 1;
  const unlockDate   = new Date(Number(capsule.unlockTime) * 1000);
  const sealDate     = new Date(Number(capsule.createdAt) * 1000);
  const isOwner      = myAddress && capsule.owner.toLowerCase() === myAddress.toLowerCase();
  const isRecipient  = myAddress && capsule.recipients.some(r => r.toLowerCase() === myAddress.toLowerCase());
  const now          = Date.now();
  const timeUnlocked = now >= unlockDate.getTime();
  const trigger      = TRIGGER_META[capsule.triggerType] ?? TRIGGER_META[0];

  const diff   = unlockDate.getTime() - now;
  const days   = Math.floor(diff / 86400000);
  const hours  = Math.floor((diff % 86400000) / 3600000);

  const countdownText =
    revealed      ? "Revealed"          :
    timeUnlocked  ? "Ready to reveal"   :
    diff < 3600000  ? `${Math.floor(diff / 60000)}m left` :
    diff < 86400000 ? `${hours}h left`  :
    `${days}d left`;

  const countdownColor =
    revealed     ? "text-green-400" :
    timeUnlocked ? "text-orange-400" :
    "text-indigo-300";

  const borderClass =
    revealed     ? "border-green-900 hover:border-green-700" :
    timeUnlocked ? "border-amber-900 hover:border-amber-700" :
    "border-border hover:border-indigo-700";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link href={`/proof/${id}`} className="block no-underline">
        <div
          className={cn(
            "rounded-xl border bg-card px-4 py-4 transition-colors duration-150",
            borderClass
          )}
        >
          {/* Top row */}
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
                revealed
                  ? "border-green-800 bg-green-950 text-green-400"
                  : "border-indigo-900 bg-indigo-950 text-indigo-400"
              )}>
                {revealed ? "REVEALED" : "SEALED"}
              </span>
              {!revealed && timeUnlocked && (
                <span className="inline-flex items-center rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-400">
                  UNLOCKED
                </span>
              )}
              {isOwner && (
                <span className="inline-flex items-center rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground">
                  MINE
                </span>
              )}
              {isRecipient && (
                <span className="inline-flex items-center rounded border border-indigo-900 bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-indigo-400">
                  RECIPIENT
                </span>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground/60">
              {sealDate.toLocaleDateString()}
            </span>
          </div>

          {/* Truncated ID */}
          <p className="mb-3 truncate font-mono text-[11px] text-muted-foreground/40">
            {id.slice(0, 14)}…{id.slice(-8)}
          </p>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px]",
              trigger.className
            )}>
              <span>{trigger.icon}</span>
              <span>{trigger.label}</span>
            </span>
            <span className={cn("text-xs font-semibold", countdownColor)}>
              {countdownText}
            </span>
          </div>

          {capsule.recipients.length > 0 && (
            <p className="mt-2.5 text-[11px] text-muted-foreground/50">
              {capsule.recipients.length} recipient{capsule.recipients.length > 1 ? "s" : ""} · ECIES-encrypted
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
