"use client";

import { useState, useEffect, use } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { toast } from "sonner";
import { ConnectButton } from "../../../../components/ConnectButton";
import { Button } from "../../../../components/ui/button";
import { getVaultInfo, approveReveal, hasApproved, multisigCanReveal } from "../../../../lib/triggers";
import { revealOnChain } from "../../../../lib/contract";
import { cn } from "../../../../lib/utils";
import type { VaultInfo } from "../../../../lib/types";

export default function MultiSigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const capsuleId = id as `0x${string}`;
  const { isConnected, address } = useAccount();

  const [vault,      setVault]      = useState<VaultInfo | null>(null);
  const [approved,   setApproved]   = useState(false);
  const [canReveal,  setCanReveal]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [status,     setStatus]     = useState("");
  const [loadError,  setLoadError]  = useState("");
  const [loaded,     setLoaded]     = useState(false);

  async function load() {
    try {
      const v = await getVaultInfo(capsuleId);
      setVault(v);
      setLoadError("");
      setLoaded(true);
      if (v && address) {
        const [app, cr] = await Promise.all([
          hasApproved(capsuleId, address as `0x${string}`),
          multisigCanReveal(capsuleId),
        ]);
        setApproved(app);
        setCanReveal(cr);
      }
    } catch (e: unknown) {
      // Don't overwrite vault data on transient RPC errors
      if (!loaded) setLoadError(e instanceof Error ? e.message : "Failed to load vault");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsuleId, address]);

  async function handleApprove() {
    setLoading(true); setStatus("Sending approval tx…");
    try {
      await approveReveal(capsuleId);
      setStatus("Approval confirmed!");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  async function handleReveal() {
    setLoading(true); setStatus("Sending reveal tx…");
    try {
      await revealOnChain(capsuleId);
      setStatus("Capsule revealed! Go to proof page to decrypt.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  const isSigner  = vault && address && vault.signers.some(s => s.toLowerCase() === address?.toLowerCase());
  const progress  = vault ? vault.approvalCount / vault.threshold : 0;

  return (
    <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="mb-6">
        <Link href={`/proof/${capsuleId}`} className="text-muted-foreground text-sm no-underline">
          ← Back to capsule
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1.5">Multi-Sig Reveal</h1>
      <p className="text-muted-foreground text-sm break-all mb-7">{capsuleId}</p>

      {!isConnected && <div className="mb-5"><ConnectButton /></div>}

      {!vault && (
        <div className="rounded-xl border border-border bg-card p-5 mb-2">
          {loadError ? (
            <p className="text-red-400 m-0 text-sm">{loadError}</p>
          ) : !loaded ? (
            <p className="text-muted-foreground m-0">Loading vault…</p>
          ) : (
            <p className="text-muted-foreground m-0">
              No vault found for this capsule. The multi-sig vault may not have been
              created — try sealing a new capsule with the Multi-sig trigger.
            </p>
          )}
        </div>
      )}

      {vault && (
        <>
          <div className={cn(
            "rounded-xl border p-5 mb-2",
            canReveal ? "border-green-900 bg-green-950/10" : "border-indigo-900 bg-indigo-950/20"
          )}>
            <p className="text-muted-foreground text-[11px] uppercase tracking-widest mb-4">
              Vault status
            </p>

            <Row label="Owner"     value={vault.owner} mono />
            <Row label="Threshold" value={`${vault.threshold} of ${vault.signers.length} signers`} />
            <Row label="Approvals" value={`${vault.approvalCount} / ${vault.threshold}`} />
            <Row label="Revealed"  value={vault.revealed ? "Yes" : "No"} />

            {/* Progress bar */}
            <div className="mt-4 mb-4">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", canReveal ? "bg-green-500" : "bg-primary")}
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <p className={`text-xs mt-1.5 ${canReveal ? "text-green-400" : "text-muted-foreground"}`}>
                {canReveal ? "Threshold reached — ready to reveal" : `${vault.threshold - vault.approvalCount} more approval(s) needed`}
              </p>
            </div>

            {/* Signer list */}
            <p className="text-muted-foreground text-[11px] uppercase tracking-widest mb-2">
              Signers
            </p>
            {vault.signers.map((s, i) => (
              <SignerRow
                key={s}
                index={i + 1}
                address={s}
                isYou={s.toLowerCase() === address?.toLowerCase()}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3 flex-wrap">
            {isConnected && isSigner && !approved && !vault.revealed && (
              <Button onClick={handleApprove} disabled={loading}>
                {loading && status.includes("Approv") ? status : "Approve Reveal"}
              </Button>
            )}
            {approved && !vault.revealed && (
              <span className="py-2.5 text-green-400 text-sm">
                ✓ You have approved
              </span>
            )}
            {isConnected && canReveal && !vault.revealed && (
              <Button onClick={handleReveal} disabled={loading} className="bg-green-900 hover:bg-green-800">
                {loading && status.includes("reveal") ? status : "Reveal Capsule"}
              </Button>
            )}
          </div>

          {status && <p className="text-green-400 mt-3 text-sm">{status}</p>}
        </>
      )}
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2.5 mb-2 text-sm">
      <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
      <span className={`break-all text-foreground/80 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function SignerRow({ index, address, isYou }: { index: number; address: string; isYou: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-1.5 text-xs">
      <span className="text-muted-foreground/60 min-w-[20px]">{index}.</span>
      <code className={`break-all ${isYou ? "text-indigo-300" : "text-muted-foreground"}`}>{address}</code>
      {isYou && <span className="text-indigo-300 text-[11px]">(you)</span>}
    </div>
  );
}
