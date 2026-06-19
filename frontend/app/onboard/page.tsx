"use client";

import { useState, useEffect } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  hasSavedPrivKey,
} from "@/lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "@/lib/contract";

const STEPS = [
  { id: 1, title: "Connect wallet",          desc: "Use MetaMask or any injected EVM wallet." },
  { id: 2, title: "Register encryption key", desc: "Generate a keypair so others can send you capsules." },
  { id: 3, title: "Seal your first capsule", desc: "Encrypt a message and lock it until the future." },
] as const;

export default function OnboardPage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const [step,       setStep]       = useState(1);
  const [regDone,    setRegDone]    = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (isConnected && step === 1) setStep(2);
    if (!isConnected && step > 1)  { setStep(1); setRegDone(false); }
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
    setRegLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      const tx  = await registerEncryptionKey(hex);
      setRegDone(true);
      setStep(3);
      toast.success("Key registered!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Switched to 0G Testnet")) {
        toast.info("Switched to 0G Testnet", { description: "Press Register again." });
      } else {
        toast.error("Registration failed", { description: msg });
      }
    } finally { setRegLoading(false); }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="mb-1.5 text-2xl font-bold">Get started</h1>
      <p className="mb-10 text-sm text-muted-foreground">Three steps to seal your first time capsule.</p>

      {/* Step indicators */}
      <div className="mb-10 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                step > s.id  ? "border-green-700 bg-green-950 text-green-400" :
                step === s.id ? "border-indigo-600 bg-indigo-950 text-indigo-300" :
                                "border-border bg-secondary text-muted-foreground"
              )}>
                {step > s.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span className={cn(
                "hidden text-[10px] font-medium sm:block",
                step === s.id ? "text-foreground" : "text-muted-foreground/60"
              )}>
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "mx-2 h-px flex-1 transition-colors",
                step > s.id + 1 ? "bg-green-800" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done   = step > s.id;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border p-5 transition-colors",
                active ? "border-indigo-800 bg-indigo-950/20" :
                done   ? "border-green-900 bg-green-950/10" :
                         "border-border bg-card opacity-40"
              )}
            >
              <div className="mb-0.5 flex items-center gap-2">
                {done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  : <Circle className={cn("h-4 w-4 shrink-0", active ? "text-indigo-400" : "text-muted-foreground/40")} />
                }
                <h3 className={cn("text-sm font-semibold", done ? "text-green-400" : active ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </h3>
              </div>
              <p className="mb-0 ml-6 text-xs text-muted-foreground">{s.desc}</p>

              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="ml-6 mt-4"
                  >
                    {/* Step 1 content */}
                    {s.id === 1 && <ConnectButton />}

                    {/* Step 2 content */}
                    {s.id === 2 && (
                      <div>
                        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                          A secp256k1 keypair is generated in your browser. Private key stays local;
                          public key is registered on-chain so senders can encrypt specifically for you.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={handleRegister} disabled={regLoading} size="sm">
                            {regLoading ? "Registering…" : "Generate & Register"}
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href="/seal">Skip (optional)</Link>
                          </Button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground/60">
                          Already registered?{" "}
                          <Link href="/register" className="text-indigo-400 hover:text-indigo-300">/register</Link>{" "}
                          to import your key.
                        </p>
                      </div>
                    )}

                    {/* Step 3 content */}
                    {s.id === 3 && (
                      <div>
                        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                          You&apos;re ready. Choose a trigger type, write your message, and seal it on-chain.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={() => router.push("/seal")} size="sm">
                            Create my first capsule →
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href="/gallery">View gallery</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Done state: show connected address for step 1 */}
              {done && s.id === 1 && (
                <div className="ml-6 mt-3 flex items-center gap-3">
                  <p className="text-xs text-green-400">
                    Connected: <code className="font-mono">{address?.slice(0, 10)}…{address?.slice(-6)}</code>
                  </p>
                  <button
                    onClick={() => disconnect()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
              {done && s.id === 2 && (
                <p className="ml-6 mt-2 text-xs text-green-400">Key registered ✓</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
