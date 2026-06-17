"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { LockOpen, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { revealCapsule, decryptAsRecipient } from "@/lib/capsule";
import { loadPrivKeyFromStorage } from "@/lib/ecies";
import type { OnChainCapsule, RevealResult } from "@/lib/types";
import { CapsuleState } from "@/lib/types";

interface Props { params: { id: string }; }

export default function RevealPage({ params }: Props) {
  const { id } = params;
  const capsuleId = id as `0x${string}`;
  const { address, isConnected } = useAccount();

  const [capsule,  setCapsule]  = useState<OnChainCapsule | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [result,   setResult]   = useState<RevealResult | null>(null);
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    let cancel = false;
    async function poll() {
      try {
        const [cap, open] = await Promise.all([getCapsule(capsuleId), isUnlocked(capsuleId)]);
        if (!cancel) { setCapsule(cap); setUnlocked(open); }
      } catch (e: unknown) {
        if (!cancel) toast.error("Failed to load capsule", { description: e instanceof Error ? e.message : String(e) });
      }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancel = true; clearInterval(t); };
  }, [capsuleId]);

  // Private capsules can only be decrypted with the wallet's local ECIES key.
  function requireKey(): Uint8Array {
    if (!address) throw new Error("Connect your wallet first");
    const privKey = loadPrivKeyFromStorage(address);
    if (!privKey) {
      throw new Error("No encryption key on this device — register or import it at /register, then retry.");
    }
    return privKey;
  }

  async function handleReveal() {
    setLoading(true); setStatus("Sending reveal tx…");
    try {
      const privKey = requireKey();
      setStatus("Revealing + decrypting…");
      setResult(await revealCapsule(capsuleId, address!, privKey));
    } catch (e: unknown) {
      toast.error("Reveal failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  async function handleDecryptAlreadyRevealed() {
    setLoading(true); setStatus("Decrypting…");
    try {
      const privKey = requireKey();
      setResult(await decryptAsRecipient(capsuleId, address!, privKey));
    } catch (e: unknown) {
      toast.error("Decryption failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  const unlockDate      = capsule ? new Date(Number(capsule.unlockTime) * 1000) : null;
  const alreadyRevealed = capsule?.state === CapsuleState.REVEALED;
  const hasLocalKey     = !!address && !!loadPrivKeyFromStorage(address);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Reveal Capsule</h1>
      <p className="mb-6 break-all font-mono text-xs text-muted-foreground">{capsuleId}</p>

      {capsule && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <MetaRow label="Owner"       value={capsule.owner} mono />
          <MetaRow label="Unlock time" value={unlockDate?.toLocaleString() ?? "—"} />
          <MetaRow label="Status"      value={alreadyRevealed ? "Revealed" : unlocked ? "Unlocked" : "Locked"} />
          <MetaRow label="Commit hash" value={capsule.commitHash} mono />
        </div>
      )}

      {!isConnected && <div className="mb-5"><ConnectButton /></div>}

      {isConnected && !hasLocalKey && (
        <div className="mb-5 rounded-lg border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-300">
          This capsule is private. Decryption needs your encryption key on this device.{" "}
          <Link href="/register" className="underline hover:text-amber-200">Register or import your key →</Link>
        </div>
      )}

      {!result && (
        <div className="flex flex-wrap gap-3">
          {!alreadyRevealed && (
            <Button
              onClick={handleReveal}
              disabled={loading || !unlocked || !isConnected || !hasLocalKey}
              variant={unlocked && isConnected && hasLocalKey ? "default" : "secondary"}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <LockOpen className="h-4 w-4 animate-pulse" />
                  {status}
                </span>
              ) : !isConnected ? "Connect wallet" :
                !hasLocalKey ? "Encryption key required" :
                !unlocked ? `Locked until ${unlockDate?.toLocaleString() ?? "…"}` :
                "Reveal & Decrypt"}
            </Button>
          )}
          {alreadyRevealed && isConnected && (
            <Button onClick={handleDecryptAlreadyRevealed} disabled={loading || !hasLocalKey}
              className="bg-green-800 hover:bg-green-700">
              {loading ? status : "Decrypt"}
            </Button>
          )}
        </div>
      )}

      {result && (
        <div className={`mt-8 rounded-xl border p-6 ${result.verified ? "border-green-800 bg-green-950/20" : "border-amber-800 bg-amber-950/20"}`}>
          <div className="mb-4 flex items-center gap-2.5">
            {result.verified
              ? <Lock className="h-5 w-5 text-green-400" />
              : <span className="text-amber-400">⚠</span>
            }
            <span className={`text-sm font-medium ${result.verified ? "text-green-400" : "text-amber-400"}`}>
              {result.verified
                ? "Verified — content matches on-chain commitment"
                : "WARNING: content hash mismatch"}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.plaintext}</p>
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[11px] text-muted-foreground">Commit: {result.commitHash}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-2 flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={`break-all ${mono ? "font-mono text-xs text-foreground/80" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
