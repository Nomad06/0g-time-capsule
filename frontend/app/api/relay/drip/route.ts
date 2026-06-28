import { NextRequest, NextResponse } from "next/server";
import { Wallet, JsonRpcProvider, isAddress, parseEther, formatEther } from "ethers";
import { guard } from "@/lib/api-guard";

const RPC_URL = process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// How much testnet gas to hand a brand-new user, and the balance below which
// they qualify. A seal + key-register costs well under this; we only top up
// users who are effectively empty so the same address can't drain the faucet
// wallet by calling repeatedly.
const DRIP_AMOUNT = parseEther("0.02");
const ELIGIBLE_BELOW = parseEther("0.01");
// Refuse to drip if the server wallet itself is nearly empty — keeps a buffer
// for its primary job (paying 0G storage fees in /api/storage/upload).
const MIN_SERVER_BALANCE = parseEther("0.1");

/** POST /api/relay/drip  body: { address: 0x… } — gives a new user gas, no faucet. */
export async function POST(req: NextRequest) {
  try {
    // Spends the funded STORAGE_PRIVATE_KEY wallet — gate hard before any work.
    const blocked = guard(req, "relay-drip", { limit: 3, windowMs: 10 * 60_000 });
    if (blocked) return blocked;

    const pk = process.env.STORAGE_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: "STORAGE_PRIVATE_KEY not configured" }, { status: 500 });
    }

    const { address }: { address?: string } = await req.json();
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const provider = new JsonRpcProvider(RPC_URL);

    // Already funded? Treat as success so the client flow continues without a tx.
    const userBalance = await provider.getBalance(address);
    if (userBalance >= ELIGIBLE_BELOW) {
      return NextResponse.json({ txHash: null, funded: true, skipped: "already-funded" });
    }

    const wallet = new Wallet(pk, provider);
    const serverBalance = await provider.getBalance(wallet.address);
    if (serverBalance < MIN_SERVER_BALANCE) {
      console.error("[relay/drip] server wallet low:", formatEther(serverBalance));
      return NextResponse.json({ error: "Faucet temporarily unavailable" }, { status: 503 });
    }

    const tx = await wallet.sendTransaction({ to: address, value: DRIP_AMOUNT });
    // Wait for one confirmation so the balance is spendable the moment the
    // client gets the response and goes straight into seal()/registerKey().
    await tx.wait(1);
    return NextResponse.json({ txHash: tx.hash, funded: true });
  } catch (e: unknown) {
    console.error("[relay/drip]", e);
    return NextResponse.json({ error: "Drip failed" }, { status: 500 });
  }
}
