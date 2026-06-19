"use client";

import { motion } from "framer-motion";

const USE_CASES = [
  { emoji: "🔮", title: "Crypto predictions",  trigger: "Time lock",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal your price targets or on-chain thesis. When you're right, reveal and prove you called it — timestamped and tamper-proof." },
  { emoji: "📜", title: "Digital legacy",       trigger: "Dead Man's Switch", triggerClass: "border-amber-900 bg-amber-950/50 text-amber-400",    desc: "Write a letter to your children or loved ones. Set a dead man's switch — if you stop checking in, the capsule unlocks automatically." },
  { emoji: "⚖️", title: "DAO governance",       trigger: "Multi-Sig",        triggerClass: "border-indigo-900 bg-indigo-950/50 text-indigo-400", desc: "Seal a proposal or decision before the vote. Require M-of-N board members to approve the reveal — fully on-chain accountability." },
  { emoji: "🔑", title: "Private delivery",     trigger: "ECIES recipients", triggerClass: "border-green-900 bg-green-950/50 text-green-400",    desc: "Send a secret to a specific wallet. Only the designated recipient can decrypt — even after the capsule is publicly revealed." },
];

const TRIGGERS = [
  { icon: "⏰", name: "Time Lock",        desc: "Unlocks at a specific Unix timestamp. Simple, predictable.",                           borderClass: "border-indigo-900" },
  { icon: "💀", name: "Dead Man's Switch", desc: "Owner must check in periodically. Miss the deadline and anyone can trigger.",          borderClass: "border-amber-900" },
  { icon: "🗳️", name: "Multi-Sig",        desc: "M-of-N designated signers must approve. Trustless group consensus.",                   borderClass: "border-indigo-900" },
];

export function CardsAnimated() {
  return (
    <>
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
    </>
  );
}
