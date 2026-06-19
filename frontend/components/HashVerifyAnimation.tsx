"use client";

import { useState, useEffect } from "react";
import { MediaRenderer } from "./MediaRenderer";

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
    <div className="mt-8">

      {/* Hash reveal animation */}
      <div className="rounded-[10px] border border-indigo-950 bg-[#0a0a14] p-5">
        <p className="mb-2 text-[11px] uppercase tracking-[1px] text-muted-foreground/60">
          Computing keccak256(revealed content)…
        </p>
        <code className="break-all text-[13px] tracking-[1px] text-indigo-400">
          {hashVisible || commitHash}
        </code>

        {phase !== "hashing" && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] uppercase tracking-[1px] text-muted-foreground/60">
              Comparing with on-chain commitment…
            </p>
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              <HashRow label="Sealed hash  " value={commitHash}  />
              <HashRow label="Revealed hash" value={revealedHash} />
            </div>

            {phase === "done" && (
              <div className={`mt-3.5 flex items-center gap-2.5 rounded-md border px-4 py-2.5 ${
                verified
                  ? "border-green-800 bg-green-950"
                  : "border-purple-800 bg-[#3b0764]"
              }`}>
                <span className="text-lg">{verified ? "✓" : "✗"}</span>
                <div>
                  <p className={`m-0 text-sm font-bold ${verified ? "text-green-400" : "text-fuchsia-400"}`}>
                    {verified ? "MATCH — content is authentic" : "MISMATCH — content may be tampered"}
                  </p>
                  {verified && sealDate && (
                    <p className="mt-0.5 text-xs text-muted-foreground/50">
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
        <div className="mt-6 animate-[fadeIn_0.6s_ease] rounded-[10px] border border-green-900 bg-[#050f05] p-7">
          <p className="mb-3 text-[11px] uppercase tracking-[1px] text-muted-foreground/60">
            Revealed content
          </p>
          <MediaRenderer content={plaintext} />
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function HashRow({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="min-w-[120px] shrink-0 text-muted-foreground/50">{l}</span>
      <span className="break-all text-indigo-400">{value}</span>
    </div>
  );
}
