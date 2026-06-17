import type { Metadata } from "next";
import { ProofClient } from "./ProofClient";
import { getPublicClient } from "../../../lib/contract";
import { TIME_CAPSULE_ABI, CONTRACT_ADDRESSES } from "../../../constants/contracts";

interface Props {
  params: Promise<{ id: string }>;
}

// Server-side fetch for OG meta
async function fetchCapsuleMeta(capsuleId: `0x${string}`) {
  try {
    const pub = getPublicClient();
    const cap = await pub.readContract({
      address:      CONTRACT_ADDRESSES.TimeCapsule,
      abi:          TIME_CAPSULE_ABI,
      functionName: "getCapsule",
      args:         [capsuleId],
    }) as {
      commitHash: `0x${string}`;
      unlockTime: bigint;
      state: number;
      createdAt: bigint;
    };
    return cap;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cap = await fetchCapsuleMeta(id as `0x${string}`);

  const sealDate = cap ? new Date(Number(cap.createdAt) * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }) : "unknown date";

  const unlockDate = cap ? new Date(Number(cap.unlockTime) * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }) : "a future date";

  const state = cap?.state === 1 ? "REVEALED" : "SEALED";

  const title = `Time Capsule [${state}] — sealed ${sealDate}`;
  const description =
    cap?.state === 1
      ? `This capsule was sealed on ${sealDate} and has now been revealed. Content verified on 0G Chain.`
      : `A sealed prediction locked until ${unlockDate}. Commitment hash stored on 0G Chain — content cannot be changed.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:      "website",
      siteName:  "0G Time Capsule",
    },
    twitter: {
      card:        "summary",
      title,
      description,
    },
  };
}

export default async function ProofPage({ params }: Props) {
  const { id } = await params;
  return <ProofClient capsuleId={id as `0x${string}`} />;
}
