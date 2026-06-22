"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { revealCapsule, decryptRevealed, decryptAsRecipient } from "@/lib/capsule";
import { loadPrivKeyFromStorage, hasSavedPrivKey } from "@/lib/ecies";
import { mintCapsuleNFT, getCapsuleTokenId } from "@/lib/nft";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";
import { formatError } from "@/lib/utils";
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
    } catch (e: unknown) {
      setError(formatError(e));
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

  async function handleReveal() {
    setLoading(true); setError(""); setStatus("Sending reveal tx…");
    try {
      setStatus("Sign to decrypt…");
      setResult(await revealCapsule(capsuleId));
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setLoading(false); }
  }

  async function handleDecrypt() {
    setLoading(true); setError(""); setStatus("Sign to decrypt…");
    try {
      setResult(await decryptRevealed(capsuleId));
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setLoading(false); }
  }

  async function handleRecipientDecrypt() {
    if (!address) return;
    setLoading(true); setError(""); setStatus("Decrypting with your local key…");
    try {
      const privKey = loadPrivKeyFromStorage(address);
      if (!privKey) throw new Error("No local encryption key found. Visit /register to import or regenerate.");
      setResult(await decryptAsRecipient(capsuleId, address, privKey));
    } catch (e: unknown) {
      setError(formatError(e));
    } finally { setLoading(false); }
  }

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
  const alreadyRevealed = capsule?.state === 1;
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
