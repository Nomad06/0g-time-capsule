"use client";

import { useState, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, LockOpen, Upload, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";
import { sealCapsule } from "@/lib/capsule";
import { TriggerType } from "@/lib/types";
import { MediaRenderer, getMediaType } from "@/components/MediaRenderer";
import { AiAssistant } from "@/components/AiAssistant";
import type { SealResult } from "@/lib/types";

const TRIGGER_OPTS = [
  { value: TriggerType.TIME,     label: "⏰ Time lock",        desc: "Unlocks at a set time" },
  { value: TriggerType.DEADMAN,  label: "💀 Dead Man's Switch", desc: "Unlocks if owner stops checking in" },
  { value: TriggerType.MULTISIG, label: "🗳️ Multi-Sig",        desc: "Unlocks when M-of-N signers approve" },
] as const;

const TEMPLATES = [
  {
    label: "✉️ Letter to future self",
    message: "Dear future me,\n\nToday is [date]. As I write this, I am thinking about...\n\nI hope that by the time you read this, you have...\n\nRemember: ",
    minutes: 525600, // 1 year in minutes
  },
  {
    label: "📈 Investment thesis",
    message: "Asset: \nDate: \nMy thesis:\n\nKey assumptions:\n1. \n2. \n\nI will consider this thesis proven if...",
    minutes: 262800, // 6 months
  },
  {
    label: "💌 Love letter",
    message: "My dearest,\n\nI am sealing these words for our anniversary.\n\n",
    minutes: 525600,
  },
  {
    label: "📣 Announcement",
    message: "We are excited to announce that on [reveal date], [company/project] will...",
    minutes: 10080, // 1 week
  },
] as const;

const MAX_FILE_MB = 50;

export default function SealPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // content mode
  const [contentMode, setContentMode] = useState<"text" | "file">("text");
  const [message,     setMessage]     = useState("");
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [fileName,    setFileName]    = useState("");

  // trigger
  const [minutes,     setMinutes]     = useState(2);
  const [triggerType, setTriggerType] = useState<TriggerType>(TriggerType.TIME);
  const [dmsInterval, setDmsInterval] = useState(1);
  const [msSigners,   setMsSigners]   = useState("");
  const [msThreshold, setMsThreshold] = useState(2);

  const [result,  setResult]  = useState<SealResult | null>(null);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(false);
  const [sealed,  setSealed]  = useState(false);

  const msSignerCount = msSigners
    .split(/[\s,]+/)
    .filter(s => s.startsWith("0x") && s.length === 42).length;

  function applyTemplate(tpl: typeof TEMPLATES[number]) {
    setContentMode("text");
    setMessage(tpl.message);
    setMinutes(tpl.minutes);
    setTriggerType(TriggerType.TIME);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_FILE_MB} MB)`);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => { setFileDataUri(reader.result as string); };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    setFileDataUri(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSeal() {
    const plaintext = contentMode === "file" ? fileDataUri ?? "" : message;
    if (!plaintext.trim()) {
      toast.error(contentMode === "file" ? "No file selected" : "Message is empty");
      return;
    }
    if (!isConnected) { toast.error("Connect wallet first"); return; }
    setLoading(true); setResult(null);

    try {
      const unlockTime = new Date(Date.now() + minutes * 60 * 1000);
      const multisigSigners = msSigners
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

      setStatus(
        triggerType === TriggerType.DEADMAN  ? "Sealing + arming dead man's switch…" :
        triggerType === TriggerType.MULTISIG ? "Sealing + creating multi-sig vault…" :
        "Encrypting + uploading to 0G Storage…"
      );

      const trigger: import("@/lib/types").TriggerConfig | undefined =
        triggerType === TriggerType.DEADMAN
          ? { type: TriggerType.DEADMAN,  intervalDays: dmsInterval }
          : triggerType === TriggerType.MULTISIG
          ? { type: TriggerType.MULTISIG, signers: multisigSigners, threshold: msThreshold }
          : undefined;

      const res = await sealCapsule({
        plaintext,
        unlockTime,
        recipients: [],
        trigger,
      });

      setResult(res);
      setSealed(true);
      toast.success("Capsule sealed!", { description: `ID: ${res.capsuleId.slice(0, 18)}…` });
      setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1800);
    } catch (e: unknown) {
      toast.error("Seal failed", { description: e instanceof Error ? e.message : String(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Seal a Capsule</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Encrypted on-chain. Decryptable only when the unlock condition is met.
      </p>

      {!isConnected && <div className="mb-6"><ConnectButton /></div>}

      {/* Templates */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Start from template</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => applyTemplate(tpl)}
              disabled={loading}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-indigo-800 hover:text-indigo-300"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI assistant (text mode only) */}
      {contentMode === "text" && (
        <div className="mb-4">
          <AiAssistant onDraft={setMessage} />
        </div>
      )}

      {/* Content mode tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setContentMode("text")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            contentMode === "text" ? "bg-indigo-950/60 text-indigo-300" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="h-3.5 w-3.5" /> Text
        </button>
        <button
          onClick={() => setContentMode("file")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            contentMode === "file" ? "bg-indigo-950/60 text-indigo-300" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="h-3.5 w-3.5" /> File / Media
        </button>
      </div>

      {/* Content input */}
      <AnimatePresence mode="wait">
        {contentMode === "text" ? (
          <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-5">
            <Textarea
              rows={6}
              placeholder="Write your message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
          </motion.div>
        ) : (
          <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-5">
            {!fileDataUri ? (
              <label className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-indigo-800 hover:bg-indigo-950/10",
                loading && "pointer-events-none opacity-50"
              )}>
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Drop file or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground/50">Image, audio, video, PDF · max {MAX_FILE_MB} MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*,video/*,application/pdf"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </label>
            ) : (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground/80 truncate">{fileName}</span>
                  <button onClick={clearFile} className="ml-2 shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-hidden rounded-md">
                  <MediaRenderer content={fileDataUri} />
                </div>
                <p className="mt-2 text-xs text-indigo-400">
                  Type: {getMediaType(fileDataUri)} · Will be AES-256-GCM encrypted before upload to 0G Storage
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger selector */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Unlock trigger</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TRIGGER_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTriggerType(opt.value)}
              aria-pressed={triggerType === opt.value}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                triggerType === opt.value
                  ? "border-indigo-700 bg-indigo-950/40 text-indigo-300"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-900 hover:text-foreground"
              )}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="mt-0.5 text-xs opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time lock config */}
      {triggerType === TriggerType.TIME && (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Unlock in</span>
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            disabled={loading}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      )}

      {/* Dead Man's Switch config */}
      {triggerType === TriggerType.DEADMAN && (
        <div className="mb-5 rounded-lg border border-amber-900/50 bg-amber-950/10 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-600">Dead Man&apos;s Switch</p>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Check-in interval</span>
            <Input type="number" min={1} value={dmsInterval}
              onChange={(e) => setDmsInterval(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            You must check in every {dmsInterval} day(s) or the capsule unlocks automatically.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Min lock window</span>
            <Input type="number" min={1} value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      )}

      {/* Multi-sig config */}
      {triggerType === TriggerType.MULTISIG && (
        <div className="mb-5 rounded-lg border border-indigo-900/50 bg-indigo-950/10 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">Multi-Sig</p>
          <label className="mb-1 block text-xs text-muted-foreground">Signers (comma-separated addresses)</label>
          <Textarea
            rows={3}
            placeholder="0xAbc…, 0xDef…"
            value={msSigners}
            onChange={(e) => setMsSigners(e.target.value)}
            disabled={loading}
            className="mb-3 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Threshold</span>
            <Input type="number" min={1} value={msThreshold}
              onChange={(e) => setMsThreshold(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              of {msSignerCount} signer{msSignerCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Min lock window</span>
            <Input type="number" min={1} value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              disabled={loading} className="w-20"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      )}

      {/* Submit + animation */}
      <AnimatePresence mode="wait">
        {sealed ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 py-2"
          >
            <motion.div
              initial={{ rotate: -90, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Lock className="h-5 w-5 text-green-400" />
            </motion.div>
            <span className="text-sm font-medium text-green-400">Capsule sealed! Redirecting…</span>
          </motion.div>
        ) : (
          <motion.div key="button">
            <Button
              onClick={handleSeal}
              disabled={loading || !isConnected}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    className="inline-flex"
                  >
                    <LockOpen className="h-4 w-4" />
                  </motion.span>
                  {status || "Sealing…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Seal Capsule
                </span>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result details (before redirect) */}
      {result && (
        <div className="mt-8 rounded-xl border border-green-900 bg-green-950/10 p-5 text-xs">
          <ResultField label="Capsule ID"   value={result.capsuleId} />
          <ResultField label="Storage Root" value={result.storageRoot} />
          <ResultField label="Commit Hash"  value={result.commitHash} />
          <ResultField label="Drand Round"  value={String(result.drandRound)} />
          <ResultField label="Tx Hash"      value={result.txHash} />
          <div className="mt-3">
            <Link href={`/proof/${result.capsuleId}`} className="text-sm text-indigo-400 hover:text-indigo-300">Go to proof page →</Link>
          </div>
        </div>
      )}
    </main>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <span className="text-muted-foreground">{label}: </span>
      <span className="break-all font-mono text-foreground/80">{value}</span>
    </div>
  );
}
