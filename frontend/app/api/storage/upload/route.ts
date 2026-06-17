import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "ethers";
// Server-side only — 0G SDK uses Node fs
import { Indexer, MemData } from "@0glabs/0g-ts-sdk";

const INDEXER_URL = process.env.ZG_INDEXER_URL  ?? "https://indexer-storage-testnet-standard.0g.ai";
const RPC_URL     = process.env.ZG_RPC_URL      ?? "https://evmrpc-testnet.0g.ai";

/** POST /api/storage/upload  body: { data: hex-encoded bytes } */
export async function POST(req: NextRequest) {
  const pk = process.env.STORAGE_PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json({ error: "STORAGE_PRIVATE_KEY not configured" }, { status: 500 });
  }

  const { data }: { data: string } = await req.json();
  if (!data) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const buf = Buffer.from(data.startsWith("0x") ? data.slice(2) : data, "hex");

  const wallet  = new Wallet(pk);
  const indexer = new Indexer(INDEXER_URL);
  const mem     = new MemData(buf);

  const [merkle, merkleErr] = await mem.merkleTree();
  if (merkleErr) return NextResponse.json({ error: String(merkleErr) }, { status: 500 });

  const rawHash = merkle!.rootHash() as string;
  const rootHash = rawHash.startsWith("0x") ? rawHash : `0x${rawHash}`;

  const [txHash, uploadErr] = await indexer.upload(mem, RPC_URL, wallet);
  if (uploadErr) return NextResponse.json({ error: String(uploadErr) }, { status: 500 });

  return NextResponse.json({ rootHash, txHash: txHash ?? null });
}
