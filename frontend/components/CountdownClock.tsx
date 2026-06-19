"use client";

import { useState, useEffect } from "react";

interface Props {
  unlockDate: Date;
  isUnlocked: boolean;
}

export function CountdownClock({ unlockDate, isUnlocked }: Props) {
  const [remaining, setRemaining] = useState(unlockDate.getTime() - Date.now());

  useEffect(() => {
    if (isUnlocked) return;
    const t = setInterval(() => setRemaining(unlockDate.getTime() - Date.now()), 500);
    return () => clearInterval(t);
  }, [unlockDate, isUnlocked]);

  if (isUnlocked) {
    return (
      <div className="rounded-[10px] border border-green-800 bg-green-950 p-6 text-center">
        <span className="mr-2.5 text-[22px]">🔓</span>
        <span className="text-base font-bold text-green-400">Capsule is now unlocked</span>
      </div>
    );
  }

  const total = Math.max(0, remaining);
  const d     = Math.floor(total / 86400000);
  const h     = Math.floor((total % 86400000) / 3600000);
  const m     = Math.floor((total % 3600000) / 60000);
  const s     = Math.floor((total % 60000) / 1000);

  return (
    <div className="rounded-[10px] border border-indigo-950 bg-[#0f0f1a] p-6 text-center">
      <p className="mb-3 text-[11px] uppercase tracking-[1px] text-muted-foreground/60">
        Unlocks in
      </p>
      <div className="flex justify-center gap-4">
        {d > 0 && <Unit n={d} label="days" />}
        <Unit n={h} label="hours" />
        <Unit n={m} label="min" />
        <Unit n={s} label="sec" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground/40">
        {unlockDate.toLocaleString()}
      </p>
    </div>
  );
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-[48px] text-center">
      <div className="text-[32px] font-bold tabular-nums text-indigo-300">
        {String(n).padStart(2, "0")}
      </div>
      <div className="text-[10px] uppercase tracking-[1px] text-muted-foreground/60">{label}</div>
    </div>
  );
}
