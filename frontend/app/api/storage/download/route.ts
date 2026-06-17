import { NextRequest, NextResponse } from "next/server";
import { Indexer } from "@0glabs/0g-ts-sdk";

const INDEXER_URL = process.env.ZG_INDEXER_URL ?? "https://indexer-storage-testnet-standard.0g.ai";

/** GET /api/storage/download?hash=0x... */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) return NextResponse.json({ error: "Missing hash" }, { status: 400 });

  const indexer = new Indexer(INDEXER_URL);
  const bareHash = hash.startsWith("0x") ? hash.slice(2) : hash;

  const result = await indexer.download(bareHash, "", false);
  if (result instanceof Error) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const buf = result as Buffer | null;
  if (!buf?.length) return NextResponse.json({ error: "Empty response" }, { status: 404 });

  return NextResponse.json({ data: `0x${buf.toString("hex")}` });
}
