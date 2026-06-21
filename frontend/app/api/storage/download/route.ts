import { NextRequest, NextResponse } from "next/server";
import { Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { normalizeHash } from "@/lib/utils";

const INDEXER_URL = process.env.ZG_INDEXER_URL ?? "https://indexer-storage-testnet-standard.0g.ai";

/** GET /api/storage/download?hash=0x... */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) return NextResponse.json({ error: "Missing hash" }, { status: 400 });

  const indexer = new Indexer(INDEXER_URL);
  const bareHash = normalizeHash(hash);

  const result = await indexer.download(bareHash, "", false);
  if (result instanceof Error) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const buf = result as Buffer | null;
  if (!buf?.length) return NextResponse.json({ error: "Empty response" }, { status: 404 });

  const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
  if (buf.length > MAX_DOWNLOAD_BYTES) {
    return NextResponse.json(
      { error: "Downloaded file exceeds 50 MB limit" },
      { status: 413 }
    );
  }

  return NextResponse.json({ data: `0x${buf.toString("hex")}` });
}
