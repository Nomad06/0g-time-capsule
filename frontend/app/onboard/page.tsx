"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";
import { useOnboardFlow, DEMO_LOCK_SECONDS, type OnboardStepId } from "@/hooks/useOnboardFlow";
import { nftMarketplaceUrl } from "@/lib/nft";

const FAUCET_URL = "https://faucet.0g.ai/";

const STEPS: { id: OnboardStepId; title: string; desc: string }[] = [
  { id: "connect", title: "Connect wallet",   desc: "Desktop: MetaMask or any injected wallet. Phone: pick WalletConnect to open your wallet app, or just browse this site inside your wallet's built-in browser." },
  { id: "network", title: "Add 0G Testnet",   desc: "Add the chain to your wallet and switch to it." },
  { id: "gas",     title: "Get test gas",     desc: "Grab free A0GI from the faucet for transaction fees." },
  { id: "key",     title: "Register key",     desc: "Generate an encryption key — required to seal private capsules." },
  { id: "seal",    title: "Seal a capsule",   desc: `Encrypt a demo message, locked for ${DEMO_LOCK_SECONDS}s.` },
  { id: "reveal",  title: "Reveal & prove",   desc: "Wait out the lock, decrypt, and verify the on-chain hash." },
];

export default function OnboardPage() {
  const f = useOnboardFlow();

  // Embedded (Privy) login auto-handles network + gas, so drop those two steps.
  const steps = f.embeddedMode
    ? STEPS.filter(s => s.id !== "network" && s.id !== "gas")
    : STEPS;

  const doneMap: Record<OnboardStepId, boolean> = {
    connect: f.isConnected,
    network: f.isConnected && f.onRightNetwork,
    gas:     f.hasGas,
    key:     f.keyDone,
    seal:    f.sealDone,
    reveal:  f.revealDone,
  };
  const activeIdx = steps.findIndex(s => s.id === f.activeStep);

  return (
    <main className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="mb-1.5 text-2xl font-bold">
        {f.embeddedMode ? "Quickstart" : "Judge quickstart"}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {f.embeddedMode
          ? "Four steps, about a minute — sign in, seal a capsule, and prove it end to end. No wallet extension or faucet needed."
          : "Six steps, ~5 minutes, one wallet — seal a capsule and prove it end to end."}
      </p>

      {/* Stepper */}
      <div className="mb-9 flex items-center">
        {steps.map((s, i) => {
          const done   = doneMap[s.id];
          const active = s.id === f.activeStep;
          return (
            <div key={s.id} className="flex flex-1 items-center last:flex-none">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                done   ? "border-green-700 bg-green-950 text-green-400" :
                active ? "border-indigo-600 bg-indigo-950 text-indigo-300" :
                         "border-border bg-secondary text-muted-foreground"
              )}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mx-1.5 h-px flex-1 transition-colors", done ? "bg-green-800" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {f.error && (
        <div className="mb-5 flex gap-2 rounded-lg border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="break-words">{f.error}</span>
        </div>
      )}

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const done   = doneMap[s.id];
          const active = s.id === f.activeStep;
          const locked = i > activeIdx && !done;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border p-5 transition-colors",
                active ? "border-indigo-800 bg-indigo-950/20" :
                done   ? "border-green-900 bg-green-950/10" :
                         "border-border bg-card",
                locked && "opacity-40"
              )}
            >
              <div className="mb-0.5 flex items-center gap-2">
                {done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  : <Circle className={cn("h-4 w-4 shrink-0", active ? "text-indigo-400" : "text-muted-foreground/40")} />}
                <h3 className={cn("text-sm font-semibold", done ? "text-green-400" : active ? "text-foreground" : "text-muted-foreground")}>
                  {i + 1}. {s.title}
                </h3>
              </div>
              <p className="ml-6 text-xs text-muted-foreground">{s.desc}</p>

              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }} className="ml-6 mt-4"
                  >
                    <StepBody step={s.id} f={f} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground/60">
        Already set up? Jump to{" "}
        <Link href="/seal" className="text-indigo-400 hover:text-indigo-300">seal</Link> or{" "}
        <Link href="/gallery" className="text-indigo-400 hover:text-indigo-300">your capsules</Link>.
      </p>
    </main>
  );
}

function StepBody({ step, f }: { step: OnboardStepId; f: ReturnType<typeof useOnboardFlow> }) {
  const busy = f.busy;

  switch (step) {
    case "connect":
      return <ConnectButton />;

    case "network":
      return (
        <div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Your wallet will prompt to add <b>0G Testnet</b> (chain 16602) and switch to it.
          </p>
          <Button size="sm" onClick={f.addNetwork} disabled={!!busy}>
            {busy ?? "Add & switch to 0G Testnet"}
          </Button>
        </div>
      );

    case "gas":
      return (
        <div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Open the faucet, sign in with X, paste your address, and request test tokens.
            <span className="block mt-1 text-muted-foreground/60">Heads-up: ~0.1 per day per wallet, captcha required.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" asChild>
              <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
                Open faucet <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={f.refresh} disabled={!!busy}>
              I&apos;ve got gas — check
            </Button>
          </div>
        </div>
      );

    case "key":
      return (
        <div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Sign once to create your encryption key. It&apos;s derived from your wallet,
            so the same key works on every device — nothing to back up.
            <b className="text-foreground"> Required</b> — capsules are private and undecryptable without it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={f.registerKey} disabled={!!busy}>
              {busy ?? "Sign & create key"}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/register">Advanced: import a key</Link>
            </Button>
          </div>
        </div>
      );

    case "seal":
      return (
        <div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Seals a sample message locked for {DEMO_LOCK_SECONDS} seconds, with you as the sole recipient.
          </p>
          <Button size="sm" onClick={f.sealDemo} disabled={!!busy}>
            {busy ?? "Seal demo capsule"}
          </Button>
        </div>
      );

    case "reveal":
      return <RevealBody f={f} />;
  }
}

function RevealBody({ f }: { f: ReturnType<typeof useOnboardFlow> }) {
  const busy = f.busy;

  if (f.result) {
    return (
      <div className={cn(
        "rounded-lg border p-4",
        f.result.verified ? "border-green-800 bg-green-950/20" : "border-amber-800 bg-amber-950/20"
      )}>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className={cn("h-4 w-4", f.result.verified ? "text-green-400" : "text-amber-400")} />
          <span className={f.result.verified ? "text-green-400" : "text-amber-400"}>
            {f.result.verified ? "HASH MATCH — content is authentic" : "Hash mismatch"}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{f.result.plaintext}</p>
        <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/proof/${f.demoCapsuleId}`}>Open proof page</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/seal">Seal your own →</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Optional NFT mint — only valid while still SEALED (mint reverts after reveal). */}
      {f.nftEnabled && !f.unlocked && (
        <div className="mb-4 rounded-lg border border-border bg-card/60 p-3">
          {f.nftTokenId ? (
            <a href={nftMarketplaceUrl(f.nftTokenId)} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300">
              NFT #{String(f.nftTokenId)} minted — view on marketplace <ExternalLink className="inline h-3 w-3" />
            </a>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Optional: mint this capsule as an NFT — only possible <b>before</b> it unlocks.
              </p>
              <Button size="sm" variant="outline" onClick={f.mintNft} disabled={!!busy}>
                {busy === "Minting NFT…" ? busy : "Mint NFT (optional)"}
              </Button>
            </>
          )}
        </div>
      )}

      {!f.unlocked ? (
        <div className="rounded-lg border border-indigo-900 bg-indigo-950/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">Unlocks in</p>
          <p className="font-mono text-3xl font-bold text-indigo-300 tabular-nums">
            {f.secondsLeft ?? "…"}<span className="text-base text-muted-foreground">s</span>
          </p>
        </div>
      ) : (
        <Button size="sm" onClick={f.reveal} disabled={!!busy} className="bg-green-800 hover:bg-green-700">
          {busy ?? "Reveal & decrypt"}
        </Button>
      )}
    </div>
  );
}
