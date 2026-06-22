import { getPublicClient, getWalletClient, waitForReceipt } from "./contract";
import { CONTRACT_ADDRESSES, CAPSULE_NFT_ABI } from "../constants/contracts";
import { zeroGTestnet } from "../constants/contracts";
import { BaseError, ContractFunctionRevertedError, parseEventLogs, type Hash } from "viem";

/** Map CapsuleNFT custom errors to actionable messages. */
function mintRevertMessage(err: unknown): string | null {
  if (!(err instanceof BaseError)) return null;
  const revert = err.walk(e => e instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError)) return null;
  switch (revert.data?.errorName) {
    case "AlreadyMinted":          return "This capsule already has an NFT minted.";
    case "NotCapsuleOwner":        return "Only the capsule owner can mint its NFT.";
    case "CapsuleAlreadyRevealed": return "Can't mint — the capsule is already revealed (mint before revealing).";
    default:                       return revert.shortMessage ?? null;
  }
}

export async function mintCapsuleNFT(capsuleId: `0x${string}`): Promise<{ tokenId: bigint; txHash: Hash }> {
  const wallet = await getWalletClient();
  const pub    = getPublicClient();

  // Simulate first so contract reverts surface as a clear reason instead of a
  // mined-but-empty receipt ("CapsuleMinted event not found").
  try {
    await pub.simulateContract({
      account:      wallet.account,
      address:      CONTRACT_ADDRESSES.CapsuleNFT,
      abi:          CAPSULE_NFT_ABI,
      functionName: "mint",
      args:         [capsuleId],
    });
  } catch (err) {
    const msg = mintRevertMessage(err);
    if (msg) throw new Error(msg);
    throw err;
  }

  const txHash = await wallet.writeContract({
    account:      wallet.account,
    chain:        zeroGTestnet,
    address:      CONTRACT_ADDRESSES.CapsuleNFT,
    abi:          CAPSULE_NFT_ABI,
    functionName: "mint",
    args:         [capsuleId],
  });

  const receipt = await waitForReceipt(txHash);
  if (receipt.status === "reverted") {
    throw new Error("Mint transaction reverted on-chain.");
  }

  const logs = parseEventLogs({
    abi:       CAPSULE_NFT_ABI,
    logs:      receipt.logs,
    eventName: "CapsuleMinted",
  });

  if (!logs[0]) {
    throw new Error("Mint succeeded but no CapsuleMinted event was emitted — check the CapsuleNFT contract address.");
  }
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
