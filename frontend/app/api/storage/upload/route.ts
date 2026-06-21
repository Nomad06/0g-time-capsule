import { NextRequest, NextResponse } from "next/server";
import { Wallet, JsonRpcProvider } from "ethers";
// Server-side only — 0G SDK uses Node fs
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { normalizeHash } from "@/lib/utils";

const INDEXER_URL = process.env.ZG_INDEXER_URL  ?? "https://indexer-storage-testnet-standard.0g.ai";
const RPC_URL     = process.env.ZG_RPC_URL      ?? "https://evmrpc-testnet.0g.ai";

/** POST /api/storage/upload  body: { data: hex-encoded bytes } */
export async function POST(req: NextRequest) {
  try {
    const pk = process.env.STORAGE_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: "STORAGE_PRIVATE_KEY not configured" }, { status: 500 });
    }

    const { data }: { data: string } = await req.json();
    if (!data) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const raw = Buffer.from(data.startsWith("0x") ? data.slice(2) : data, "hex");
    // 0G storage minimum unit is 1 chunk = 256 bytes
    const buf = raw.length < 256 ? Buffer.concat([raw, Buffer.alloc(256 - raw.length)]) : raw;

    const provider = new JsonRpcProvider(RPC_URL);
    const wallet   = new Wallet(pk, provider);
    const indexer  = new Indexer(INDEXER_URL);
    const mem      = new MemData(buf);

    const [merkle, merkleErr] = await mem.merkleTree();
    if (merkleErr) return NextResponse.json({ error: String(merkleErr) }, { status: 500 });

    const rawHash = merkle!.rootHash() as string;
    const rootHash: `0x${string}` = `0x${normalizeHash(rawHash)}`;

    const [txHash, uploadErr] = await indexer.upload(mem, RPC_URL, wallet);
    if (uploadErr) return NextResponse.json({ error: String(uploadErr) }, { status: 500 });

    return NextResponse.json({ rootHash, txHash: txHash ?? null });
  } catch (e: unknown) {
    console.error("[storage/upload]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
