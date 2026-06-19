import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { zeroGTestnet, CONTRACT_ADDRESSES, TIME_CAPSULE_ABI } from "../../../../constants/contracts";

const pub = createPublicClient({ chain: zeroGTestnet, transport: http() });

export async function GET(
  _req: NextRequest,
  { params }: { params: { capsuleId: string } }
) {
  const capsuleId = params.capsuleId as `0x${string}`;

  try {
    const raw = await pub.readContract({
      address:      CONTRACT_ADDRESSES.TimeCapsule,
      abi:          TIME_CAPSULE_ABI,
      functionName: "getCapsule",
      args:         [capsuleId],
    }) as { unlockTime: bigint; state: number; owner: string; triggerType: number };

    const unlockDate  = new Date(Number(raw.unlockTime) * 1000).toISOString();
    const revealed    = raw.state === 1;
    const triggerName = ["Time Lock", "Dead Man's Switch", "Oracle", "Multi-Sig"][raw.triggerType] ?? "Unknown";

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://0g-time-capsule.vercel.app";

    return NextResponse.json({
      name:        `0G Time Capsule ${capsuleId.slice(0, 10)}…`,
      description: revealed
        ? "This capsule has been revealed. View its contents on the proof page."
        : `A sealed time capsule on 0G blockchain. Unlock condition: ${triggerName}. Unlocks: ${unlockDate}.`,
      image:       `${base}/api/og/${capsuleId}`,
      external_url: `${base}/proof/${capsuleId}`,
      attributes: [
        { trait_type: "Trigger",  value: triggerName },
        { trait_type: "State",    value: revealed ? "Revealed" : "Sealed" },
        { trait_type: "Unlock",   value: unlockDate },
        { trait_type: "Owner",    value: raw.owner  },
      ],
    });
  } catch {
    return NextResponse.json({ error: "Capsule not found" }, { status: 404 });
  }
}
