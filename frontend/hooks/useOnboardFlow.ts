"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  getPublicClient,
  registerEncryptionKey,
  hasEncryptionKey,
  getCapsule,
  isUnlocked,
} from "@/lib/contract";
import { hasSavedPrivKey } from "@/lib/ecies";
import { getOrCreateIdentityKey } from "@/lib/identity";
import { PRIVY_APP_ID } from "@/lib/privy-config";
import { sealCapsule, revealCapsule } from "@/lib/capsule";
import { mintCapsuleNFT, getCapsuleTokenId } from "@/lib/nft";
import { zeroGTestnet, CONTRACT_ADDRESSES } from "@/constants/contracts";
import { CapsuleState } from "@/lib/types";
import type { RevealResult } from "@/lib/types";
import { formatError } from "@/lib/utils";
import { computeActiveStep, type OnboardStepId } from "./onboardSteps";

export { computeActiveStep, type OnboardStepId };

/** Seconds the demo capsule stays locked — long enough for the drand round, short
 *  enough that a judge will actually wait it out. */
export const DEMO_LOCK_SECONDS = 60;

export const DEMO_PLAINTEXT =
  "This is a 0G Time Capsule demo. Sealed, encrypted client-side, locked by the chain, " +
  "and provable against an on-chain keccak256 commitment. If you can read this after the " +
  "countdown, the full lifecycle works end to end. 🔐";

const demoKey = (addr: string) => `0g-onboard-demo-${addr.toLowerCase()}`;

export interface OnboardState {
  // wallet
  address:     `0x${string}` | undefined;
  isConnected: boolean;
  onRightNetwork: boolean;
  // per-step done flags
  hasGas:    boolean;
  keyDone:   boolean;
  sealDone:  boolean;
  revealDone: boolean;
  // demo capsule
  demoCapsuleId: `0x${string}` | null;
  unlocked:      boolean;
  secondsLeft:   number | null;
  nftTokenId:    bigint | null;
  result:        RevealResult | null;
  // ux
  activeStep: OnboardStepId;
  busy:       string | null;   // label of the in-flight action, or null
  error:      string;
  nftEnabled: boolean;
  embeddedMode: boolean;       // Privy login active → collapsed 4-step flow
}

export interface OnboardActions {
  addNetwork:  () => Promise<void>;
  registerKey: () => Promise<void>;
  sealDemo:    () => Promise<void>;
  mintNft:     () => Promise<void>;
  reveal:      () => Promise<void>;
  refresh:     () => Promise<void>;
}

export function useOnboardFlow(): OnboardState & OnboardActions {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const onRightNetwork = chainId === zeroGTestnet.id;
  const nftEnabled     = CONTRACT_ADDRESSES.CapsuleNFT !== "0x";

  // With Privy enabled the embedded wallet defaults to 0G and gas is auto-dripped
  // by the relayer at write time, so the "add network" and "get gas" steps are
  // unnecessary — the seal/key writes self-heal (switch chain + drip) anyway.
  // We collapse the flow to connect → key → seal → reveal.
  const embeddedMode = !!PRIVY_APP_ID;

  const [hasGas,        setHasGas]        = useState(false);
  const [keyDone,       setKeyDone]       = useState(false);
  const [demoCapsuleId, setDemoCapsuleId] = useState<`0x${string}` | null>(null);
  const [revealDone,    setRevealDone]    = useState(false);
  const [unlocked,      setUnlocked]      = useState(false);
  const [secondsLeft,   setSecondsLeft]   = useState<number | null>(null);
  const [nftTokenId,    setNftTokenId]    = useState<bigint | null>(null);
  const [result,        setResult]        = useState<RevealResult | null>(null);

  const [busy,  setBusy]  = useState<string | null>(null);
  const [error, setError] = useState("");

  const sealDone = !!demoCapsuleId;

  // ── State detection ──────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!address || !isConnected) return;
    const pub = getPublicClient();

    // balance
    try {
      const bal = await pub.getBalance({ address });
      setHasGas(bal > 0n);
    } catch { /* transient RPC */ }

    // registration: needs BOTH the on-chain pubkey and the local privkey
    try {
      const local = hasSavedPrivKey(address);
      const onCh  = await hasEncryptionKey(address);
      setKeyDone(local && onCh);
    } catch { /* transient */ }

    // demo capsule (persisted per address)
    const stored = (typeof window !== "undefined"
      ? window.localStorage.getItem(demoKey(address))
      : null) as `0x${string}` | null;
    setDemoCapsuleId(stored);

    if (stored) {
      try {
        const [cap, open] = await Promise.all([getCapsule(stored), isUnlocked(stored)]);
        setUnlocked(open);
        setRevealDone(cap.state === CapsuleState.REVEALED);
      } catch { /* transient */ }
      if (nftEnabled) {
        try {
          const t = await getCapsuleTokenId(stored);
          if (t > 0n) setNftTokenId(t);
        } catch { /* none yet */ }
      }
    }
  }, [address, isConnected, nftEnabled]);

  // Re-detect on account / network change, then poll.
  useEffect(() => {
    setError("");
    setResult(null);
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh, chainId]);

  // Local countdown for the demo capsule's unlock.
  useEffect(() => {
    if (!demoCapsuleId || revealDone) { setSecondsLeft(null); return; }
    let cancelled = false;
    async function tick() {
      try {
        const cap = await getCapsule(demoCapsuleId!);
        const unlockMs = Number(cap.unlockTime) * 1000;
        const update = () => {
          if (cancelled) return;
          const left = Math.max(0, Math.ceil((unlockMs - Date.now()) / 1000));
          setSecondsLeft(left);
          setUnlocked(left === 0);
        };
        update();
        const iv = setInterval(update, 1000);
        return () => clearInterval(iv);
      } catch { /* transient */ }
    }
    const cleanup = tick();
    return () => { cancelled = true; cleanup.then(fn => fn && fn()); };
  }, [demoCapsuleId, revealDone]);

  // ── Active step = first incomplete ─────────────────────────────────────────────

  // In embedded mode, treat network + gas as satisfied so the active step jumps
  // straight from connect to key.
  const activeStep = computeActiveStep({
    isConnected,
    onRightNetwork: embeddedMode || onRightNetwork,
    hasGas:         embeddedMode || hasGas,
    keyDone,
    sealDone,
  });

  // ── Actions ────────────────────────────────────────────────────────────────────

  const addNetwork = useCallback(async () => {
    setError(""); setBusy("Adding 0G Testnet…");
    try {
      // wagmi's injected connector falls back to wallet_addEthereumChain when the
      // chain (configured in wagmiConfig) is not yet known to the wallet.
      await switchChainAsync({ chainId: zeroGTestnet.id });
    } catch (e) {
      setError(formatError(e));
    } finally { setBusy(null); }
  }, [switchChainAsync]);

  const registerKey = useCallback(async () => {
    if (!address) return;
    setError(""); setBusy("Registering encryption key…");
    try {
      const { pubKey } = await getOrCreateIdentityKey(address);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      await registerEncryptionKey(hex);
      setKeyDone(true);
    } catch (e) {
      setError(formatError(e));
    } finally { setBusy(null); await refresh(); }
  }, [address, refresh]);

  const sealDemo = useCallback(async () => {
    if (!address) return;
    setError(""); setBusy("Sealing demo capsule…");
    try {
      const unlockTime = new Date(Date.now() + DEMO_LOCK_SECONDS * 1000);
      // Owner-only (no extra recipients): the judge is the sole recipient, so one
      // wallet seals AND decrypts — no second party needed for the demo.
      const res = await sealCapsule({ plaintext: DEMO_PLAINTEXT, unlockTime, recipients: [] });
      window.localStorage.setItem(demoKey(address), res.capsuleId);
      setDemoCapsuleId(res.capsuleId);
    } catch (e) {
      setError(formatError(e));
    } finally { setBusy(null); }
  }, [address]);

  const mintNft = useCallback(async () => {
    if (!demoCapsuleId) return;
    setError(""); setBusy("Minting NFT…");
    try {
      const { tokenId } = await mintCapsuleNFT(demoCapsuleId);
      setNftTokenId(tokenId);
    } catch (e) {
      setError(formatError(e));
    } finally { setBusy(null); }
  }, [demoCapsuleId]);

  const reveal = useCallback(async () => {
    if (!address || !demoCapsuleId) return;
    setError(""); setBusy("Revealing + decrypting…");
    try {
      const { privKey } = await getOrCreateIdentityKey(address);
      const r = await revealCapsule(demoCapsuleId, address, privKey);
      setResult(r);
      setRevealDone(true);
    } catch (e) {
      setError(formatError(e));
    } finally { setBusy(null); }
  }, [address, demoCapsuleId]);

  return {
    address, isConnected, onRightNetwork,
    hasGas: embeddedMode || hasGas, keyDone, sealDone, revealDone,
    demoCapsuleId, unlocked, secondsLeft, nftTokenId, result,
    activeStep, busy, error, nftEnabled, embeddedMode,
    addNetwork, registerKey, sealDemo, mintNft, reveal, refresh,
  };
}
