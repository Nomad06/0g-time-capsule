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

export function HeroAnimated() {
  return (
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
  );
}
