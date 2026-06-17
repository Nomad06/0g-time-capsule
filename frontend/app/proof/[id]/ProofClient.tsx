"use client";

import Link from "next/link";
import { nftMarketplaceUrl } from "../../../lib/nft";
import { HashVerifyAnimation } from "../../../components/HashVerifyAnimation";
import { CountdownClock } from "../../../components/CountdownClock";
import { Button } from "../../../components/ui/button";
import { TriggerType } from "../../../lib/types";
import { useProofFlow } from "../../../hooks/useProofFlow";
import { usePoll } from "../../../hooks/usePoll";

interface Props {
  capsuleId: `0x${string}`;
}

export function ProofClient({ capsuleId }: Props) {
  const {
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
    isOwner,
    isRecipient,
    hasLocalKey,
    alreadyRevealed,
    unlockDate,
    sealDate,
    poll,
    handleReveal,
    handleDecrypt,
    handleMintNFT,
    copyLink,
  } = useProofFlow(capsuleId);

  usePoll(poll, 5000, [capsuleId]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold tracking-widest border ${
              alreadyRevealed
                ? "bg-green-950 text-green-400 border-green-800"
                : "bg-indigo-950 text-indigo-300 border-indigo-800"
            }`}>
              {alreadyRevealed ? "REVEALED" : "SEALED"}
            </span>
            {unlocked && !alreadyRevealed && (
              <span className="px-2.5 py-0.5 rounded text-[11px] bg-orange-950 text-orange-400 border border-orange-900">
                UNLOCKED
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold m-0">Time Capsule</h1>
          <p className="text-muted-foreground text-xs mt-1 break-all">{capsuleId}</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyLink}>
          {copied ? "✓ Copied" : "Share link"}
        </Button>
      </div>

      {/* Proof block — visible to ANYONE, no wallet needed */}
      {capsule && (
        <div className="rounded-xl border border-border bg-card p-6 mb-2">
          <p className="text-muted-foreground text-[11px] uppercase tracking-widest mb-4">
            On-chain commitment
          </p>
          <ProofRow label="Sealed"       value={sealDate?.toLocaleString() ?? "—"} />
          <ProofRow label="Unlocks"      value={unlockDate?.toLocaleString() ?? "—"} />
          <ProofRow label="Commit hash"  value={capsule.commitHash} mono highlight />
          <ProofRow label="Storage root" value={capsule.storageRoot} mono />
          <ProofRow label="Owner"        value={capsule.owner} mono />

          <p className="text-muted-foreground text-xs mt-4 leading-relaxed">
            The commit hash is <strong className="text-muted-foreground">keccak256(plaintext)</strong> stored on 0G Chain at seal time.
            When revealed, anyone can verify the content matches — proving it was written before the seal date.
          </p>
        </div>
      )}

      {/* Countdown — only for time-locked capsules; MULTISIG/DEADMAN have their own unlock condition */}
      {capsule && !alreadyRevealed && unlockDate &&
       capsule.triggerType === TriggerType.TIME && (
        <div className="my-8">
          <CountdownClock unlockDate={unlockDate} isUnlocked={unlocked} />
        </div>
      )}

      {/* MULTISIG: show approval-pending hint instead of misleading countdown */}
      {capsule && !alreadyRevealed && !unlocked &&
       capsule.triggerType === TriggerType.MULTISIG && (
        <div className="my-8 rounded-xl border border-indigo-900 bg-indigo-950/20 p-5 text-center">
          <p className="text-indigo-300 font-semibold mb-1">Awaiting multi-sig approval</p>
          <p className="text-muted-foreground text-sm">
            Designated signers must approve on the{" "}
            <a href={`/triggers/multisig/${capsuleId}`} className="text-indigo-400 underline">
              Multi-Sig Reveal page
            </a>{" "}
            before this capsule can be revealed.
          </p>
        </div>
      )}

      {/* DEADMAN: show waiting hint when overdue but not yet triggered */}
      {capsule && !alreadyRevealed && !unlocked &&
       capsule.triggerType === TriggerType.DEADMAN && (
        <div className="my-8 rounded-xl border border-orange-900 bg-orange-950/20 p-5 text-center">
          <p className="text-orange-300 font-semibold mb-1">Waiting for Dead Man's Switch</p>
          <p className="text-muted-foreground text-sm">
            Owner must miss a check-in before this capsule unlocks.{" "}
            <a href={`/triggers/deadman/${capsuleId}`} className="text-indigo-400 underline">
              View switch status →
            </a>
          </p>
        </div>
      )}

      {/* Stage 3: trigger management links */}
      {capsule && capsule.triggerType === TriggerType.DEADMAN && (
        <div className="my-4 px-4 py-3 bg-orange-950/30 border border-orange-900 rounded-lg">
          <span className="text-orange-400 text-sm font-bold">Dead Man&apos;s Switch</span>
          {" — "}
          <Link href={`/triggers/deadman/${capsuleId}`} className="text-indigo-300 text-sm">
            Manage switch (check in / trigger) →
          </Link>
        </div>
      )}
      {capsule && capsule.triggerType === TriggerType.MULTISIG && (
        <div className="my-4 px-4 py-3 bg-indigo-950/30 border border-indigo-900 rounded-lg">
          <span className="text-indigo-300 text-sm font-bold">Multi-Sig Reveal</span>
          {" — "}
          <Link href={`/triggers/multisig/${capsuleId}`} className="text-indigo-300 text-sm">
            Manage approvals →
          </Link>
        </div>
      )}

      {/* Actions — every capsule is private; only owner + recipients can decrypt,
          and only with their local ECIES key. */}
      {!result && capsule && (() => {
        const canAccess  = isOwner || isRecipient;
        const keyNotice  = (
          <p className="text-amber-400 text-xs mt-1.5">
            Decryption needs your encryption key on this device.{" "}
            <a href="/register" className="text-indigo-300">Register or import your key →</a>
          </p>
        );
        return (
        <div className="my-6">
          {!isConnected && (
            <p className="text-muted-foreground text-sm">
              Connect your wallet to {alreadyRevealed ? "decrypt" : "reveal"} — owner and recipients only.
            </p>
          )}

          {isConnected && !canAccess && (
            <p className="text-muted-foreground text-sm">
              This capsule is private. Only the owner and named recipients can decrypt it.
            </p>
          )}

          {isConnected && canAccess && unlocked && !alreadyRevealed && (
            <div>
              <Button onClick={handleReveal} disabled={loading || !hasLocalKey}>
                {loading ? status : "Reveal & Decrypt"}
              </Button>
              {!hasLocalKey && keyNotice}
            </div>
          )}

          {isConnected && canAccess && alreadyRevealed && (
            <div>
              <Button
                onClick={handleDecrypt}
                disabled={loading || !hasLocalKey}
                className={hasLocalKey ? "bg-green-900 hover:bg-green-800" : "bg-muted text-muted-foreground"}
              >
                {loading ? status : "Decrypt"}
              </Button>
              {!hasLocalKey && keyNotice}
            </div>
          )}
        </div>
        );
      })()}

      {/* NFT mint */}
      {nftEnabled && isConnected && isOwner && !alreadyRevealed && (
        <div className="my-4 flex items-center gap-3">
          {nftTokenId ? (
            <a
              href={nftMarketplaceUrl(nftTokenId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              🎟 NFT #{String(nftTokenId)} minted — view on marketplace →
            </a>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMintNFT}
              disabled={nftLoading}
              className="border-indigo-800 text-indigo-400 hover:bg-indigo-950 hover:text-indigo-300"
            >
              {nftLoading ? "Minting…" : "🎟 Mint as NFT"}
            </Button>
          )}
          <span className="text-xs text-muted-foreground/50">Transfer reveal rights via NFT</span>
        </div>
      )}

      {error && <p className="text-red-400 mt-3 text-sm">{error}</p>}

      {/* Reveal result with animation */}
      {result && (
        <HashVerifyAnimation
          plaintext={result.plaintext}
          commitHash={capsule?.commitHash ?? result.commitHash}
          revealedHash={result.commitHash}
          verified={result.verified}
          sealDate={sealDate}
        />
      )}

      <div className="mt-12 pt-6 border-t border-border">
        <Link href="/gallery" className="text-muted-foreground text-sm no-underline">← All capsules</Link>
        {" · "}
        <Link href="/seal" className="text-muted-foreground text-sm no-underline">Create your own</Link>
      </div>
    </main>
  );
}

function ProofRow({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex gap-3 mb-2.5 items-start text-sm">
      <span className="text-muted-foreground min-w-[100px] shrink-0">{label}</span>
      <span className={`break-all ${mono ? "font-mono" : ""} ${highlight ? "text-indigo-300 font-bold" : "text-foreground/80"}`}>
        {value}
      </span>
    </div>
  );
}
