"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

const USE_CASES = [
  { emoji: "🔮", title: "Crypto predictions",  trigger: "Time lock",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal your price targets or on-chain thesis. When you're right, reveal and prove you called it — timestamped and tamper-proof." },
  { emoji: "📜", title: "Digital legacy",       trigger: "Dead Man's Switch", triggerClass: "border-amber-900 bg-amber-950/50 text-amber-400",    desc: "Write a letter to your children or loved ones. Set a dead man's switch — if you stop checking in, the capsule unlocks automatically." },
  { emoji: "⚖️", title: "DAO governance",       trigger: "Multi-Sig",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal a proposal or decision before the vote. Require M-of-N board members to approve the reveal — fully on-chain accountability." },
  { emoji: "🔑", title: "Private delivery",     trigger: "ECIES recipients", triggerClass: "border-green-900 bg-green-950/50 text-green-400",    desc: "Send a secret to a specific wallet. Only the designated recipient can decrypt — even after the capsule is publicly revealed." },
];

const STEPS = [
  { title: "Seal",        desc: "Write your message. It's encrypted client-side with AES-256-GCM. The keccak256 commitment is stored on 0G Chain; ciphertext on 0G Storage.", code: "TimeCapsule.seal(storageRoot, commitHash, timelockHeader, unlockTime, …)" },
  { title: "Wait",        desc: "The contract enforces the unlock condition — time, dead man's switch, or multi-sig. No one can decrypt early, not even you.",                  code: "require(block.timestamp >= unlockTime || triggerContract.canReveal(…))" },
  { title: "Reveal + Prove", desc: "Anyone calls reveal(). The contract emits the timelock header. The revealed plaintext is verified against the on-chain commitment.",      code: "verify(capsuleId, keccak256(plaintext)) → true" },
];

const TRIGGERS = [
  { icon: "⏰", name: "Time Lock",        desc: "Unlocks at a specific Unix timestamp. Simple, predictable.",                           borderClass: "border-indigo-900" },
  { icon: "💀", name: "Dead Man's Switch", desc: "Owner must check in periodically. Miss the deadline and anyone can trigger.",          borderClass: "border-amber-900" },
  { icon: "🗳️", name: "Multi-Sig",        desc: "M-of-N designated signers must approve. Trustless group consensus.",                   borderClass: "border-indigo-900" },
];

const STACK = [
  { name: "0G Chain",        role: "EVM — unlock logic + registry" },
  { name: "0G Storage",      role: "Off-chain ciphertext (content-addressed)" },
  { name: "AES-256-GCM",     role: "Symmetric payload encryption" },
  { name: "secp256k1 ECIES", role: "Per-recipient key encryption" },
  { name: "keccak256",       role: "Proof-of-existence commitment" },
  { name: "Next.js 14",      role: "App Router + server OG meta" },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border px-6 pb-20 pt-24 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-2xl"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block rounded-full border border-border px-3.5 py-1 text-xs text-muted-foreground tracking-wider mb-7">
              Built on 0G Chain + 0G Storage
            </span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Seal a secret.<br />
            Prove it later.<br />
            <span className="text-indigo-400">No third party.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Encrypt any message on-chain. Locked until a future date, a missed check-in,
            or a multi-sig vote. When revealed, the on-chain commitment proves it was never changed.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            <Link
              href="/onboard"
              className="rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start here →
            </Link>
            <Link
              href="/seal"
              className="rounded-lg border border-border px-7 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-indigo-800 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create capsule
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Use cases */}
      <section className="border-b border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Use cases</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">What people seal</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map(uc => (
              <motion.div
                key={uc.emoji}
                whileHover={{ y: -4 }}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-indigo-900"
              >
                <div className="mb-3 text-3xl">{uc.emoji}</div>
                <h3 className="mb-2 text-sm font-bold text-foreground">{uc.title}</h3>
                <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${uc.triggerClass}`}>
                  {uc.trigger}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border bg-card/30 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">How it works</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">Three steps, zero trust</h2>
          <div className="flex flex-col">
            {STEPS.map((s, i) => (
              <div key={i} className="flex gap-5 border-b border-border py-7 last:border-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-800 bg-indigo-950 font-bold text-sm text-indigo-300">
                  {i + 1}
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-foreground">{s.title}</h3>
                  <p className="mb-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <code className="text-xs text-muted-foreground/50">{s.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="border-b border-border px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Trigger types</p>
          <h2 className="mb-10 text-2xl font-bold sm:text-3xl">Unlock on your terms</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {TRIGGERS.map(t => (
              <motion.div
                key={t.name}
                whileHover={{ y: -4 }}
                className={`rounded-xl border bg-card p-5 ${t.borderClass}`}
              >
                <div className="mb-3 text-3xl">{t.icon}</div>
                <h3 className="mb-2 text-sm font-bold text-foreground">{t.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-border bg-card/30 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Architecture</p>
          <h2 className="mb-8 text-2xl font-bold sm:text-3xl">Fully on-chain. No trusted server.</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {STACK.map(s => (
              <div key={s.name} className="flex min-w-36 flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-left">
                <span className="text-sm font-bold text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Ready to seal your first capsule?</h2>
          <p className="mb-8 text-muted-foreground">Takes 2 minutes. No sign-up. Connect any EVM wallet.</p>
          <Link
            href="/onboard"
            className="rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Get started →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <p className="text-xs text-muted-foreground/50">
          0G Time Capsule — built on{" "}
          <a href="https://0g.ai" className="hover:text-muted-foreground transition-colors" target="_blank" rel="noopener noreferrer">0G Network</a>
          {" · "}
          <a href="https://github.com/Nomad06/0g-time-capsule" className="hover:text-muted-foreground transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </main>
  );
}
