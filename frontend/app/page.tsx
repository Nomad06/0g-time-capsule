import Link from "next/link";
import { HeroAnimated } from "./_landing/HeroAnimated";
import { CardsAnimated } from "./_landing/CardsAnimated";

const STEPS = [
  { title: "Seal",        desc: "Write your message. It's encrypted client-side with AES-256-GCM. The keccak256 commitment is stored on 0G Chain; ciphertext on 0G Storage.", code: "TimeCapsule.seal(storageRoot, commitHash, timelockHeader, unlockTime, …)" },
  { title: "Wait",        desc: "The contract enforces the unlock condition — time, dead man's switch, or multi-sig. No one can decrypt early, not even you.",                  code: "require(block.timestamp >= unlockTime || triggerContract.canReveal(…))" },
  { title: "Reveal + Prove", desc: "After unlock, the owner and named recipients decrypt with their own key — no one else can. The plaintext is verified against the on-chain commitment.", code: "verify(capsuleId, keccak256(plaintext)) → true" },
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
    <main className="relative min-h-screen overflow-hidden">
      {/* Decorative backdrops */}
      <div className="absolute left-[10%] top-[20%] -z-10 h-[400px] w-[400px] rounded-full bg-violet-600/5 blur-[120px]" />
      <div className="absolute right-[10%] top-[40%] -z-10 h-[450px] w-[450px] rounded-full bg-fuchsia-600/5 blur-[140px]" />

      {/* Hero */}
      <section className="border-b border-white/[0.06] px-6 pb-24 pt-28 text-center">
        <HeroAnimated />
      </section>

      {/* Use cases + Triggers */}
      <CardsAnimated />

      {/* How it works */}
      <section className="border-b border-white/[0.06] bg-black/10 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-400">How it works</p>
            <h2 className="font-title text-3xl font-extrabold text-white">Three Steps, Zero Trust</h2>
          </div>
          <div className="flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <div key={i} className="glass-card p-6 flex gap-5 rounded-2xl border border-white/[0.05] hover:border-violet-500/20 transition-all duration-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 font-title font-bold text-sm text-violet-400">
                  {i + 1}
                </div>
                <div>
                  <h3 className="mb-1.5 font-title text-sm font-bold text-white">{s.title}</h3>
                  <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="rounded-lg bg-black/40 border border-white/[0.04] p-2.5">
                    <code className="text-[10px] font-semibold text-violet-300 font-mono tracking-tight">{s.code}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-white/[0.06] bg-black/20 px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-400">Architecture</p>
          <h2 className="mb-12 font-title text-3xl font-extrabold text-white">Fully On-Chain. No Trusted Servers.</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {STACK.map(s => (
              <div key={s.name} className="glass-card p-5 rounded-2xl text-left border border-white/[0.05] hover:border-violet-500/25 transition-all duration-300">
                <span className="block text-sm font-bold text-white mb-1">{s.name}</span>
                <span className="block text-xs text-muted-foreground leading-snug">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28 text-center relative">
        <div className="absolute left-1/2 top-1/2 -z-10 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/5 blur-[120px]" />
        <div className="mx-auto max-w-xl">
          <h2 className="mb-4 font-title text-3xl font-black text-white">Ready to seal your first capsule?</h2>
          <p className="mb-10 text-xs sm:text-sm text-muted-foreground leading-relaxed">Takes less than 2 minutes. No email or signup required. Connect any EVM wallet to start.</p>
          <Link
            href="/onboard"
            className="relative inline-flex overflow-hidden rounded-xl bg-violet-600 px-10 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] transition-all hover:bg-violet-500 focus-visible:outline-none"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] px-6 py-10 text-center bg-black/45">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
          0G Time Capsule — built on{" "}
          <a href="https://0g.ai" className="text-violet-400 hover:underline transition-colors" target="_blank" rel="noopener noreferrer">0G Network</a>
          {" · "}
          <a href="https://github.com/Nomad06/0g-time-capsule" className="text-violet-400 hover:underline transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </main>
  );
}
