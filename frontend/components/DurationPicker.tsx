"use client";

import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

/** Minute multipliers per unit. Months = 30d, years = 365d (approximations). */
const UNIT_MIN: Record<string, number> = {
  minutes: 1,
  hours:   60,
  days:    1440,
  weeks:   10080,
  months:  43200,
  years:   525600,
};

const UNITS = Object.keys(UNIT_MIN);

const PRESETS: { label: string; minutes: number }[] = [
  { label: "1 hour",  minutes: 60 },
  { label: "1 day",   minutes: 1440 },
  { label: "1 week",  minutes: 10080 },
  { label: "1 month", minutes: 43200 },
  { label: "1 year",  minutes: 525600 },
];

/** Pick the largest unit that divides `minutes` evenly, for a clean display. */
function splitMinutes(minutes: number): { num: number; unit: string } {
  for (const unit of [...UNITS].reverse()) {
    const mult = UNIT_MIN[unit];
    if (minutes >= mult && minutes % mult === 0) {
      return { num: minutes / mult, unit };
    }
  }
  return { num: minutes, unit: "minutes" };
}

interface Props {
  /** Current duration in minutes (canonical unit). */
  minutes:   number;
  onChange:  (minutes: number) => void;
  disabled?: boolean;
  /** Hide preset chips (e.g. for short "min lock window" fields). */
  hidePresets?: boolean;
}

export function DurationPicker({ minutes, onChange, disabled, hidePresets }: Props) {
  const initial = splitMinutes(minutes);
  const [num,  setNum]  = useState(initial.num);
  const [unit, setUnit] = useState(initial.unit);

  // Re-sync local fields when a preset or external change moves `minutes`.
  useEffect(() => {
    const { num: n, unit: u } = splitMinutes(minutes);
    setNum(n);
    setUnit(u);
  }, [minutes]);

  function emit(n: number, u: string) {
    const m = Math.max(1, Math.round(n * UNIT_MIN[u]));
    onChange(m);
  }

  return (
    <div>
      {!hidePresets && (
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.minutes)}
              disabled={disabled}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                minutes === p.minutes
                  ? "border-indigo-700 bg-indigo-950/40 text-indigo-300"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-900 hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">In</span>
        <Input
          type="number"
          min={1}
          value={num}
          onChange={(e) => { const n = Number(e.target.value); setNum(n); emit(n, unit); }}
          disabled={disabled}
          className="w-24"
        />
        <select
          value={unit}
          onChange={(e) => { setUnit(e.target.value); emit(num, e.target.value); }}
          disabled={disabled}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground/80 disabled:opacity-50"
        >
          {UNITS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
