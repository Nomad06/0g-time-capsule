"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider } from "ethers";
import { getCapsule, isUnlocked } from "@/lib/contract";
import { revealCapsule, decryptRevealed, decryptAsRecipient } from "@/lib/capsule";
import { loadPrivKeyFromStorage, hasSavedPrivKey } from "@/lib/ecies";
import { mintCapsuleNFT, getCapsuleTokenId } from "@/lib/nft";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";
import type { OnChainCapsule, RevealResult } from "@/lib/types";

export interface ProofFlowState {
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

  async function poll() {
    try {
      const [cap, open] = await Promise.all([getCapsule(capsuleId), isUnlocked(capsuleId)]);
      setCapsule(cap);
      setUnlocked(open);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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

  async function getSigner() {
    if (!window.ethereum) throw new Error("No wallet detected");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new BrowserProvider(window.ethereum as any);
    return provider.getSigner();
  }

  async function handleReveal() {
    setLoading(true); setError(""); setStatus("Sending reveal tx…");
    try {
      const signer = await getSigner();
      setStatus("Sign to decrypt…");
      setResult(await revealCapsule(capsuleId, signer));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleDecrypt() {
    setLoading(true); setError(""); setStatus("Sign to decrypt…");
    try {
      const signer = await getSigner();
      setResult(await decryptRevealed(capsuleId, signer));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleMintNFT() {
    setNftLoading(true);
    try {
      const { tokenId } = await mintCapsuleNFT(capsuleId);
      setNftTokenId(tokenId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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

  // Suppress unused-var warning — isConnected is used in the component but
  // we keep it here so the hook is self-contained and the component can rely
  // on it directly without re-calling useAccount.
  void isConnected;

  return {
    // state
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
