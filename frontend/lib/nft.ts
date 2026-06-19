import { getPublicClient, getWalletClient } from "./contract";
import { CONTRACT_ADDRESSES, CAPSULE_NFT_ABI } from "../constants/contracts";
import { zeroGTestnet } from "../constants/contracts";
import type { Hash } from "viem";

export async function mintCapsuleNFT(capsuleId: `0x${string}`): Promise<{ tokenId: bigint; txHash: Hash }> {
  const wallet = await getWalletClient();
  const pub    = getPublicClient();

  const txHash = await wallet.writeContract({
    account:      wallet.account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.CapsuleNFT,
    abi:          CAPSULE_NFT_ABI,
    functionName: "mint",
    args:         [capsuleId],
  });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  // parse CapsuleMinted event
  const log = receipt.logs.find(l => l.topics[0] !== undefined);
  // tokenId is the second indexed topic (topics[2])
  const tokenId = log?.topics[2] ? BigInt(log.topics[2]) : 0n;

  return { tokenId, txHash };
}

export async function getCapsuleTokenId(capsuleId: `0x${string}`): Promise<bigint> {
  const pub = getPublicClient();
  return pub.readContract({
    address:      CONTRACT_ADDRESSES.CapsuleNFT,
    abi:          CAPSULE_NFT_ABI,
    functionName: "capsuleToToken",
    args:         [capsuleId],
  }) as Promise<bigint>;
}

export function nftMarketplaceUrl(tokenId: bigint): string {
  // OpenSea testnet — replace with actual chain/contract when deployed
  const contract = CONTRACT_ADDRESSES.CapsuleNFT;
  return `https://testnets.opensea.io/assets/custom/${contract}/${tokenId}`;
}
