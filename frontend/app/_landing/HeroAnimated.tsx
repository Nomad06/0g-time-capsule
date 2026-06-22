"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ShieldCheck, CalendarClock } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12 } },
};

export function HeroAnimated() {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl relative"
    >
      {/* Decorative background glows */}
      <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="absolute left-1/3 top-10 -z-10 h-[250px] w-[250px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <motion.div variants={fadeUp}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Powered by 0G decentralized Storage & Chain
        </span>
      </motion.div>

      <motion.h1 variants={fadeUp} className="mb-6 font-title text-4xl font-black tracking-tight leading-[1.1] sm:text-5xl md:text-6xl text-white">
        Seal a secret.
        <br />
        Prove it later.
        <br />
        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent glow-text-primary">
          Zero trusted parties.
        </span>
      </motion.h1>

      <motion.p variants={fadeUp} className="mx-auto mb-10 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
        Securely time-lock data with AES-256-GCM. Unlocks only when conditions are met: future date, missed check-in switch, or multi-sig consensus. Proven on-chain.
      </motion.p>

      <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
        <Link
          href="/onboard"
          className="relative group overflow-hidden rounded-xl bg-violet-600 px-8 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:bg-violet-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] focus-visible:outline-none"
        >
          <span className="relative z-10">Get Started</span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
        </Link>
        
        <Link
          href="/seal"
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-8 py-4 text-xs font-bold uppercase tracking-wider text-white/80 transition-all hover:border-violet-500/30 hover:text-white hover:bg-white/[0.05] focus-visible:outline-none"
        >
          Create Capsule
        </Link>
      </motion.div>
    </motion.div>
  );
}
