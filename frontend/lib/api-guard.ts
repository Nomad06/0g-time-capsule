import { NextRequest, NextResponse } from "next/server";

// Lightweight, dependency-free protections for public API routes.
// NOTE: the rate-limit store is per-instance (in-memory). On Vercel each
// serverless instance keeps its own window, so this is a deterrent against
// casual abuse / accidental loops, not a hard guarantee. For strong limits
// back it with Upstash/Redis. Good enough for a public demo.

interface Window { count: number; resetAt: number }
const buckets = new Map<string, Window>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns true if the request is within the limit; false if it should be rejected. */
export function rateLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  const w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/**
 * Rejects cross-origin browser callers. If an Origin header is present it must
 * match the request host. Requests without an Origin (e.g. curl) still pass the
 * origin gate but are caught by the rate limiter.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Runs origin + rate-limit guards. Returns a NextResponse to short-circuit on
 * rejection, or null to proceed. Pass a stable `name` per route so each route
 * gets its own bucket.
 */
export function guard(
  req: NextRequest,
  name: string,
  opts: { limit: number; windowMs: number },
): NextResponse | null {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Date.now() is fine in route handlers (not in workflow scripts).
  const now = Date.now();
  if (!rateLimit(`${name}:${clientIp(req)}`, opts.limit, opts.windowMs, now)) {
    return NextResponse.json({ error: "Rate limit exceeded — slow down." }, { status: 429 });
  }
  return null;
}
