import Link from "next/link";
import { HeroAnimated } from "./_landing/HeroAnimated";
import { CardsAnimated } from "./_landing/CardsAnimated";

const STEPS = [
  { title: "Seal",        desc: "Write your message. It's encrypted client-side with AES-256-GCM. The keccak256 commitment is stored on 0G Chain; ciphertext on 0G Storage.", code: "TimeCapsule.seal(storageRoot, commitHash, timelockHeader, unlockTime, …)" },
  { title: "Wait",        desc: "The contract enforces the unlock condition — time, dead man's switch, or multi-sig. No one can decrypt early, not even you.",                  code: "require(block.timestamp >= unlockTime || triggerContract.canReveal(…))" },
  { title: "Reveal + Prove", desc: "Anyone calls reveal(). The contract emits the timelock header. The revealed plaintext is verified against the on-chain commitment.",      code: "verify(capsuleId, keccak256(plaintext)) → true" },
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
        <HeroAnimated />
      </section>

      {/* Use cases + Triggers (animated client islands) */}
      <CardsAnimated />

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
