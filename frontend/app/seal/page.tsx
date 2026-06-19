"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, LockOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConnectButton } from "@/components/ConnectButton";
import { sealCapsule } from "@/lib/capsule";
import { TriggerType } from "@/lib/types";
import type { SealResult } from "@/lib/types";

export default function SealPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const [message,   setMessage]   = useState("");
  const [minutes,   setMinutes]   = useState(2);
  const [result,    setResult]    = useState<SealResult | null>(null);
  const [status,    setStatus]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [sealed,    setSealed]    = useState(false);

  async function handleSeal() {
    if (!message.trim()) { toast.error("Message is empty"); return; }
    if (!isConnected)    { toast.error("Connect wallet first"); return; }
    setLoading(true); setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);
      setStatus("Encrypting + uploading to 0G…");

      const res = await sealCapsule({
        plaintext:   message,
        unlockTime,
        recipients:  [],
        triggerType: TriggerType.TIME,
      });

      setResult(res);
      setSealed(true);
      toast.success("Capsule sealed!", { description: `ID: ${res.capsuleId.slice(0, 18)}…` });
      setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1800);
    } catch (e: unknown) {
      toast.error("Seal failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Seal a Capsule</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Encrypted on-chain. Decryptable only when the unlock time is reached.
      </p>

      {!isConnected && <div className="mb-6"><ConnectButton /></div>}

      {/* Message */}
      <div className="mb-5">
        <Textarea
          rows={5}
          placeholder="Write your message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Time lock config */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Unlock in</span>
        <Input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          disabled={loading}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">minutes</span>
      </div>

      {/* Submit + animation */}
      <AnimatePresence mode="wait">
        {sealed ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 py-2"
          >
            <motion.div
              initial={{ rotate: -90, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Lock className="h-5 w-5 text-green-400" />
            </motion.div>
            <span className="text-sm font-medium text-green-400">Capsule sealed! Redirecting…</span>
          </motion.div>
        ) : (
          <motion.div key="button">
            <Button
              onClick={handleSeal}
              disabled={loading || !isConnected}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    className="inline-flex"
                  >
                    <LockOpen className="h-4 w-4" />
                  </motion.span>
                  {status || "Sealing…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Seal Capsule
                </span>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result details (before redirect) */}
      {result && (
        <div className="mt-8 rounded-xl border border-green-900 bg-green-950/10 p-5 text-xs">
          <ResultField label="Capsule ID"   value={result.capsuleId} />
          <ResultField label="Storage Root" value={result.storageRoot} />
          <ResultField label="Commit Hash"  value={result.commitHash} />
          <ResultField label="Drand Round"  value={String(result.drandRound)} />
          <ResultField label="Tx Hash"      value={result.txHash} />
          <div className="mt-3">
            <Link href={`/proof/${result.capsuleId}`} className="text-sm text-indigo-400 hover:text-indigo-300">Go to proof page →</Link>
          </div>
        </div>
      )}
    </main>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <span className="text-muted-foreground">{label}: </span>
      <span className="break-all font-mono text-foreground/80">{value}</span>
    </div>
  );
}
