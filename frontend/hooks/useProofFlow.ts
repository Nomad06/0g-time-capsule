"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { revealCapsule, decryptAsRecipient } from "@/lib/capsule";
import { hasSavedPrivKey } from "@/lib/ecies";
import { getOrCreateIdentityKey } from "@/lib/identity";
import { mintCapsuleNFT, getCapsuleTokenId } from "@/lib/nft";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";
import { formatError } from "@/lib/utils";
import { CapsuleState } from "@/lib/types";
import type { OnChainCapsule, RevealResult } from "@/lib/types";

export interface ProofFlowState {
  isConnected: boolean;
  capsule:    OnChainCapsule | null;
  unlocked:   boolean;
  result:     RevealResult | null;
  status:     string;
  loading:    boolean;
  error:      string;
  copied:     boolean;
  nftTokenId: bigint | null;
  nftLoading: boolean;
  nftEnabled: boolean;
  // derived
  isOwner:       boolean;
  isRecipient:   boolean;
  hasLocalKey:   boolean;
  alreadyRevealed: boolean;
  unlockDate:    Date | null;
  sealDate:      Date | null;
}

export interface ProofFlowActions {
  poll:                  () => Promise<void>;
  initNft:               () => Promise<void>;
  handleReveal:          () => Promise<void>;
  handleDecrypt:         () => Promise<void>;
  handleRecipientDecrypt:() => Promise<void>;
  handleMintNFT:         () => Promise<void>;
  copyLink:              () => void;
}

export function useProofFlow(capsuleId: `0x${string}`): ProofFlowState & ProofFlowActions {
  const { isConnected, address } = useAccount();

  const [capsule,    setCapsule]    = useState<OnChainCapsule | null>(null);
  const [unlocked,   setUnlocked]   = useState(false);
  const [result,     setResult]     = useState<RevealResult | null>(null);
  const [status,     setStatus]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [copied,     setCopied]     = useState(false);
  const [nftTokenId, setNftTokenId] = useState<bigint | null>(null);
  const [nftLoading, setNftLoading] = useState(false);

  const nftEnabled = CONTRACT_ADDRESSES.CapsuleNFT !== "0x";

  // Auto-load token ID for already-minted NFTs on mount / capsuleId change
  useEffect(() => {
    if (nftEnabled) initNft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsuleId, nftEnabled]);

  async function poll() {
    try {
      const [cap, open] = await Promise.all([getCapsule(capsuleId), isUnlocked(capsuleId)]);
      setCapsule(cap);
      setUnlocked(open);
    } catch {
      // RPC timeouts on slow testnet — don't clobber UI with transient noise
    }
  }

  async function initNft() {
    if (!nftEnabled || !capsuleId) return;
    try {
      const id = await getCapsuleTokenId(capsuleId);
      if (id > 0n) setNftTokenId(id);
    } catch {
      // ignore — NFT may not exist yet
    }
  }

  // Every capsule is private: decryption always uses this wallet's ECIES key, for
  // owner and recipients alike. The key is derived from a wallet signature, so if
  // it isn't cached on this device we re-derive it (a quick, gasless signature)
  // rather than failing — cross-device decrypt just works.
  async function requireKey(): Promise<Uint8Array> {
    if (!address) throw new Error("Connect your wallet first");
    const { privKey } = await getOrCreateIdentityKey(address);
    return privKey;
  }

  async function handleReveal() {
    setLoading(true); setError(""); setStatus("Sending reveal tx…");
    try {
      const privKey = await requireKey();
      setStatus("Revealing + decrypting…");
      setResult(await revealCapsule(capsuleId, address!, privKey));
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setLoading(false); setStatus(""); }
  }

  async function handleDecrypt() {
    setLoading(true); setError(""); setStatus("Decrypting with your local key…");
    try {
      const privKey = await requireKey();
      setResult(await decryptAsRecipient(capsuleId, address!, privKey));
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setLoading(false); setStatus(""); }
  }

  // Kept as a distinct name for the recipient-specific button; same local-key path.
  const handleRecipientDecrypt = handleDecrypt;

  async function handleMintNFT() {
    setNftLoading(true);
    try {
      const { tokenId } = await mintCapsuleNFT(capsuleId);
      setNftTokenId(tokenId);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setNftLoading(false); }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Derived values
  const isOwner        = !!(capsule && address && capsule.owner.toLowerCase() === address.toLowerCase());
  const isRecipient    = !!(capsule && address &&
    capsule.recipients.some(r => r.toLowerCase() === address.toLowerCase()));
  const hasLocalKey    = address ? hasSavedPrivKey(address) : false;
  const alreadyRevealed = capsule?.state === CapsuleState.REVEALED;
  const unlockDate      = capsule ? new Date(Number(capsule.unlockTime) * 1000) : null;
  const sealDate        = capsule ? new Date(Number(capsule.createdAt) * 1000) : null;

  return {
    // state
    isConnected,
    capsule,
    unlocked,
    result,
    status,
    loading,
    error,
    copied,
    nftTokenId,
    nftLoading,
    nftEnabled,
    // derived
    isOwner,
    isRecipient,
    hasLocalKey,
    alreadyRevealed,
    unlockDate,
    sealDate,
    // actions
    poll,
    initNft,
    handleReveal,
    handleDecrypt,
    handleRecipientDecrypt,
    handleMintNFT,
    copyLink,
  };
}
