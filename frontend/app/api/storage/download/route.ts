import { NextRequest, NextResponse } from "next/server";
import { Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { tmpdir } from "os";
import { join } from "path";
import { readFileSync, unlinkSync } from "fs";
import { normalizeHash } from "@/lib/utils";

const INDEXER_URL = process.env.ZG_INDEXER_URL ?? "https://indexer-storage-testnet-standard.0g.ai";

/** GET /api/storage/download?hash=0x... */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) return NextResponse.json({ error: "Missing hash" }, { status: 400 });

  const indexer  = new Indexer(INDEXER_URL);
  const bareHash = normalizeHash(hash);

  // SDK writes to disk — use a unique temp path and read back
  const tmpPath = join(tmpdir(), `0g-dl-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    const err = await indexer.download(bareHash, tmpPath, false);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const buf = readFileSync(tmpPath);
    if (!buf.length) return NextResponse.json({ error: "Empty response" }, { status: 404 });

    const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
    if (buf.length > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: "Downloaded file exceeds 50 MB limit" }, { status: 413 });
    }

    return NextResponse.json({ data: `0x${buf.toString("hex")}` });
  } finally {
    try { unlinkSync(tmpPath); } catch { /* already gone or never created */ }
  }
}
