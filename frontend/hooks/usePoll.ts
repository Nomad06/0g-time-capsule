import { useEffect, useRef } from "react";

/**
 * Repeatedly calls `fn` on mount and every `intervalMs` milliseconds.
 * Cancels on unmount or when deps change.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number, deps: unknown[] = []) {
  // Keep a stable ref so callers can pass an inline function without
  // causing infinite re-registration.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!cancelled) await fnRef.current();
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
