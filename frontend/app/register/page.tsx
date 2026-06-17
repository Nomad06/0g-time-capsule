"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { CheckCircle2, Circle, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConnectButton } from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  generateEncryptionKeypair,
  savePrivKeyToStorage,
  loadPrivKeyFromStorage,
  hasSavedPrivKey,
} from "@/lib/ecies";
import { registerEncryptionKey, hasEncryptionKey } from "@/lib/contract";

export default function RegisterPage() {
  const { isConnected, address } = useAccount();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [hasLocal,    setHasLocal]   = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [pubkeyHex,   setPubkeyHex]  = useState("");

  useEffect(() => {
    if (!address) return;
    setHasLocal(hasSavedPrivKey(address));
    hasEncryptionKey(address).then(setRegistered).catch(() => setRegistered(false));
  }, [address]);

  async function handleRegister() {
    if (!address) return;
    setLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      setHasLocal(true);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);
      const tx = await registerEncryptionKey(hex);
      setRegistered(true);
      toast.success("Key registered on-chain!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Switched to 0G Testnet")) {
        toast.info("Switched to 0G Testnet", { description: "Press Register again." });
      } else {
        toast.error("Registration failed", { description: msg });
      }
    } finally { setLoading(false); }
  }

  async function handleReRegister() {
    if (!address) return;
    setLoading(true);
    try {
      const { privKey, pubKey } = generateEncryptionKeypair();
      savePrivKeyToStorage(address, privKey);
      const hex = `0x${Buffer.from(pubKey).toString("hex")}` as `0x${string}`;
      setPubkeyHex(hex);
      const tx = await registerEncryptionKey(hex);
      setRegistered(true);
      toast.success("Key updated on-chain!", { description: `Tx: ${tx.slice(0, 18)}…` });
    } catch (e: unknown) {
      toast.error("Re-registration failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); }
  }

  function handleExportKey() {
    if (!address) return;
    const privKey = loadPrivKeyFromStorage(address);
    if (!privKey) { toast.error("No local key found"); return; }
    const blob = new Blob([Buffer.from(privKey).toString("hex")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `0g-capsule-key-${address.slice(0, 8)}.txt`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Private key exported");
  }

  function handleImportKey(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    const reader = new FileReader();
    reader.onload = () => {
      const hex = (reader.result as string).trim();
      if (hex.length !== 64) { toast.error("Invalid key file", { description: "Expected 32-byte hex string." }); return; }
      savePrivKeyToStorage(address, new Uint8Array(Buffer.from(hex, "hex")));
      setHasLocal(true);
      toast.success("Key imported successfully");
    };
    reader.readAsText(file);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Register Encryption Key</h1>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        Generate a secp256k1 keypair in your browser. The private key stays in
        localStorage; the public key is registered on-chain so others can seal
        capsules specifically for you.
      </p>

      {!isConnected && (
        <div className="mb-6">
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <div className="flex flex-col gap-4">
          {/* Status indicators */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <StatusRow ok={registered === true} label="On-chain key registered" />
              <StatusRow ok={hasLocal}            label="Local private key saved" />
              {pubkeyHex && (
                <div className="mt-2 rounded-md bg-secondary p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Public key</p>
                  <code className="break-all text-[11px] text-indigo-300">{pubkeyHex}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warning states */}
          {registered && !hasLocal && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
              On-chain key found but no local private key. Import your backup or
              re-register (this invalidates capsules encrypted to the old key).
            </div>
          )}

          {!registered && !hasLocal && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No key registered yet. Click below to generate a keypair and register
              your public key on-chain.
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {!registered && (
              <Button onClick={handleRegister} disabled={loading}>
                {loading ? "Registering…" : "Generate & Register"}
              </Button>
            )}
            {registered && (
              <Button variant="secondary" onClick={handleReRegister} disabled={loading}>
                {loading ? "Updating…" : "Re-register (new key)"}
              </Button>
            )}
            {hasLocal && (
              <Button variant="outline" onClick={handleExportKey}>
                <Download className="mr-1.5 h-4 w-4" />
                Export key
              </Button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="h-4 w-4" />
            Import key from backup
            <input
              type="file"
              accept=".txt"
              onChange={handleImportKey}
              className="sr-only"
            />
          </label>

          <p className="text-xs text-muted-foreground/60">
            ⚠ Back up your private key. If you clear localStorage you can no longer decrypt
            capsules sent to you.
          </p>
        </div>
      )}
    </main>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {ok
        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
        : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      }
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
