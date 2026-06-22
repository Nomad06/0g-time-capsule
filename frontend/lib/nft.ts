import { getPublicClient, getWalletClient } from "./contract";
import { CONTRACT_ADDRESSES, CAPSULE_NFT_ABI } from "../constants/contracts";
import { zeroGTestnet } from "../constants/contracts";
import { parseEventLogs, type Hash } from "viem";

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

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });

  const logs = parseEventLogs({
    abi:       CAPSULE_NFT_ABI,
    logs:      receipt.logs,
    eventName: "CapsuleMinted",
  });

  if (!logs[0]) throw new Error("CapsuleMinted event not found in receipt");
  const tokenId = (logs[0].args as { tokenId: bigint }).tokenId;

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
