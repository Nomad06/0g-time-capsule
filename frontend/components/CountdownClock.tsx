"use client";

import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";

interface Props {
  unlockDate: Date;
  isUnlocked: boolean;
  compact?:   boolean;
}

export function CountdownClock({ unlockDate, isUnlocked, compact }: Props) {
  const [remaining, setRemaining] = useState(unlockDate.getTime() - Date.now());

  useEffect(() => {
    if (isUnlocked) return;
    const t = setInterval(() => setRemaining(unlockDate.getTime() - Date.now()), 500);
    return () => clearInterval(t);
  }, [unlockDate, isUnlocked]);

  const total = Math.max(0, remaining);
  const d     = Math.floor(total / 86400000);
  const h     = Math.floor((total % 86400000) / 3600000);
  const m     = Math.floor((total % 3600000) / 60000);
  const s     = Math.floor((total % 60000) / 1000);

  if (isUnlocked) {
    if (compact) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><Unlock className="h-3 w-3" /> Unlocked</span>;
    return (
      <div className="glass-card border-emerald-500/20 bg-emerald-950/20 p-6 text-center rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <Unlock className="h-5 w-5" />
        </div>
        <span className="text-base font-title font-bold text-emerald-400 glow-text-primary">Capsule is now unlocked</span>
      </div>
    );
  }

  if (compact) {
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400"><Lock className="h-3 w-3 text-violet-500" /> {parts.join(" ")}</span>;
  }

  return (
    <div className="glass-card-glow p-7 text-center rounded-2xl relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl" />
      <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-fuchsia-600/10 blur-2xl" />
      
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse">
        <Lock className="h-5 w-5" />
      </div>

      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-violet-400/80">
        Time Lock Protocol Active
      </p>
      
      <div className="flex justify-center gap-5">
        {d > 0 && <Unit n={d} label="days" />}
        <Unit n={h} label="hours" />
        <Unit n={m} label="mins" />
        <Unit n={s} label="secs" />
      </div>
      
      <div className="mt-5 inline-block rounded-full bg-white/[0.03] px-3.5 py-1 text-[11px] font-medium text-muted-foreground border border-white/[0.05]">
        Target: {unlockDate.toLocaleString()}
      </div>
    </div>
  );
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-[54px] rounded-lg bg-black/30 border border-white/[0.03] py-2.5 px-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
      <div className="text-3xl font-bold font-title tabular-nums bg-gradient-to-b from-white to-violet-300 bg-clip-text text-transparent leading-none">
        {String(n).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</div>
    </div>
  );
}
