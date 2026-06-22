"use client";

import { motion } from "framer-motion";
import { Lock, HeartPulse, Users, ShieldAlert } from "lucide-react";

const USE_CASES = [
  { 
    icon: <Lock className="h-6 w-6 text-violet-400" />, 
    title: "Crypto Predictions",  
    trigger: "Time Lock",        
    triggerClass: "border-violet-500/20 bg-violet-500/5 text-violet-400", 
    desc: "Seal price targets or on-chain theses. Prove you called it first without revealing it before the timestamp." 
  },
  { 
    icon: <HeartPulse className="h-6 w-6 text-fuchsia-400" />, 
    title: "Digital Legacy",       
    trigger: "Dead Man's Switch", 
    triggerClass: "border-fuchsia-500/20 bg-fuchsia-500/5 text-fuchsia-400",    
    desc: "Write letters or secrets to loved ones. If you stop checking in, your capsule automatically unlocks." 
  },
  { 
    icon: <Users className="h-6 w-6 text-indigo-400" />, 
    title: "DAO Governance",       
    trigger: "Multi-Sig",        
    triggerClass: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400", 
    desc: "Seal secret proposals or agreements before votes. Unlocks only after M-of-N validators sign off." 
  },
  { 
    icon: <ShieldAlert className="h-6 w-6 text-rose-400" />, 
    title: "Private Delivery",     
    trigger: "ECIES Recipients", 
    triggerClass: "border-rose-500/20 bg-rose-500/5 text-rose-400",    
    desc: "Encrypt directly to target recipient keys. Only designated keys can ever decrypt the data payload." 
  },
];

const TRIGGERS = [
  { icon: "⏰", name: "Time Lock",        desc: "Automated contract unlock at a specific future Unix timestamp.", borderClass: "border-violet-500/20" },
  { icon: "💀", name: "Dead Man's Switch", desc: "Periodic vital signs check-in resets countdown. Miss it, and it goes public.", borderClass: "border-fuchsia-500/20" },
  { icon: "🗳️", name: "Multi-Sig Consensus", desc: "Requires cryptographic signatures from designated addresses to authorize reveal.", borderClass: "border-indigo-500/20" },
];

export function CardsAnimated() {
  return (
    <>
      {/* Use cases */}
      <section className="border-b border-white/[0.06] px-6 py-24 relative overflow-hidden">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-400">Applications</p>
            <h2 className="font-title text-3xl font-extrabold sm:text-4xl text-white">What will you seal?</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map(uc => (
              <motion.div
                key={uc.title}
                whileHover={{ y: -6, scale: 1.01 }}
                className="glass-card p-6 transition-all duration-300 glow-border-hover rounded-2xl flex flex-col justify-between min-h-[260px]"
              >
                <div>
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    {uc.icon}
                  </div>
                  <h3 className="mb-2.5 font-title text-sm font-bold text-white">{uc.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">{uc.desc}</p>
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${uc.triggerClass}`}>
                    {uc.trigger}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="border-b border-white/[0.06] bg-black/20 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-violet-400">Trigger Conditions</p>
            <h2 className="font-title text-3xl font-extrabold sm:text-4xl text-white">Automated On-Chain Release</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {TRIGGERS.map(t => (
              <motion.div
                key={t.name}
                whileHover={{ y: -6 }}
                className={`glass-card p-6 border transition-all duration-300 glow-border-hover rounded-2xl ${t.borderClass}`}
              >
                <div className="mb-4 text-3xl">{t.icon}</div>
                <h3 className="mb-2 font-title text-base font-bold text-white">{t.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
