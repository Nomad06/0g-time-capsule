import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert caught error to a string without losing the message. */
export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Strip a leading "0x" prefix from a hex string.
 * Safe to call on already-stripped strings.
 */
export function normalizeHash(h: string): string {
  return h.startsWith("0x") ? h.slice(2) : h;
}
