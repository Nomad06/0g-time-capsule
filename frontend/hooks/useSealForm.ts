"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sealCapsule, resolveRecipients } from "@/lib/capsule";
import { TriggerType } from "@/lib/types";
import type { SealResult, TriggerConfig } from "@/lib/types";
import { formatError } from "@/lib/utils";

const MAX_FILE_MB = 50;

export interface SealFormState {
  // content
  contentMode:   "text" | "file";
  message:       string;
  fileDataUri:   string | null;
  fileName:      string;
  // trigger
  minutesFromNow: number;
  unlockMode:     "relative" | "absolute";
  absoluteLocal:  string;
  trigger:        TriggerType;
  dmsInterval:    number;
  msSignersRaw:   string;
  msThreshold:    number;
  recipientsRaw:  string;
  // derived
  msSignerCount:    number;
  recipientCount:   number;
  // async state
  result:  SealResult | null;
  status:  string;
  loading: boolean;
  sealed:  boolean;
  // refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface SealFormActions {
  setContentMode:   (v: "text" | "file") => void;
  setMessage:       (v: string) => void;
  setMinutesFromNow:(v: number) => void;
  setUnlockMode:    (v: "relative" | "absolute") => void;
  setAbsoluteLocal: (v: string) => void;
  setTrigger:       (v: TriggerType) => void;
  setDmsInterval:   (v: number) => void;
  setMsSignersRaw:  (v: string) => void;
  setMsThreshold:   (v: number) => void;
  setRecipientsRaw: (v: string) => void;
  applyTemplate:    (tpl: { message: string; minutesFromNow: number }) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile:        () => void;
  handleSeal:       () => Promise<void>;
}

export function useSealForm(): SealFormState & SealFormActions {
  const { isConnected } = useAccount();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) clearTimeout(redirectTimer.current);
    };
  }, []);

  // content mode
  const [contentMode, setContentMode] = useState<"text" | "file">("text");
  const [message,     setMessage]     = useState("");
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [fileName,    setFileName]    = useState("");

  // trigger
  const [minutesFromNow, setMinutesFromNow] = useState(1440); // default 1 day
  const [unlockMode,     setUnlockMode]     = useState<"relative" | "absolute">("relative");
  const [absoluteLocal,  setAbsoluteLocal]  = useState("");
  const [trigger,        setTrigger]        = useState<TriggerType>(TriggerType.TIME);
  const [dmsInterval,    setDmsInterval]    = useState(1);
  const [msSignersRaw,   setMsSignersRaw]   = useState("");
  const [msThreshold,    setMsThreshold]    = useState(2);
  const [recipientsRaw,  setRecipientsRaw]  = useState("");

  const [result,  setResult]  = useState<SealResult | null>(null);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(false);
  const [sealed,  setSealed]  = useState(false);

  const parseAddrs = (raw: string) =>
    raw.split(/[\s,]+/).map(s => s.trim())
      .filter(s => s.startsWith("0x") && s.length === 42) as `0x${string}`[];

  const msSignerCount  = parseAddrs(msSignersRaw).length;
  const recipientCount = parseAddrs(recipientsRaw).length;

  function applyTemplate(tpl: { message: string; minutesFromNow: number }) {
    setContentMode("text");
    setMessage(tpl.message);
    setMinutesFromNow(tpl.minutesFromNow);
    setUnlockMode("relative");
    setTrigger(TriggerType.TIME);
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
      // TIME trigger may use an absolute calendar date; others use the relative
      // min-lock window. Absolute avoids drift between picking and sealing.
      let unlockTime: Date;
      if (trigger === TriggerType.TIME && unlockMode === "absolute") {
        if (!absoluteLocal) { toast.error("Pick an unlock date"); setLoading(false); return; }
        unlockTime = new Date(absoluteLocal);
      } else {
        unlockTime = new Date(Date.now() + minutesFromNow * 60 * 1000);
      }
      const multisigSigners = parseAddrs(msSignersRaw);

      // Resolve recipient addresses → ECIES pubkeys from KeyRegistry before seal.
      // Throws early (clear message) if any recipient hasn't registered a key.
      const recipientAddrs = parseAddrs(recipientsRaw);
      let recipients: Awaited<ReturnType<typeof resolveRecipients>> = [];
      if (recipientAddrs.length > 0) {
        setStatus("Resolving recipient keys from KeyRegistry…");
        recipients = await resolveRecipients(recipientAddrs);
      }

      setStatus(
        trigger === TriggerType.DEADMAN  ? "Sealing + arming dead man's switch…" :
        trigger === TriggerType.MULTISIG ? "Sealing + creating multi-sig vault…" :
        "Encrypting + uploading to 0G Storage…"
      );

      const triggerCfg: TriggerConfig | undefined =
        trigger === TriggerType.DEADMAN
          ? { type: TriggerType.DEADMAN,  intervalDays: dmsInterval }
          : trigger === TriggerType.MULTISIG
          ? { type: TriggerType.MULTISIG, signers: multisigSigners, threshold: msThreshold }
          : undefined;

      const res = await sealCapsule({
        plaintext,
        unlockTime,
        recipients,
        trigger: triggerCfg,
      });

      setResult(res);
      setSealed(true);
      toast.success("Capsule sealed!", { description: `ID: ${res.capsuleId.slice(0, 18)}…` });
      redirectTimer.current = setTimeout(() => router.push(`/proof/${res.capsuleId}`), 1800);
    } catch (e: unknown) {
      toast.error("Seal failed", { description: formatError(e) });
    } finally { setLoading(false); setStatus(""); }
  }

  return {
    // state
    contentMode,
    message,
    fileDataUri,
    fileName,
    minutesFromNow,
    unlockMode,
    absoluteLocal,
    trigger,
    dmsInterval,
    msSignersRaw,
    msThreshold,
    recipientsRaw,
    msSignerCount,
    recipientCount,
    result,
    status,
    loading,
    sealed,
    fileInputRef,
    // actions
    setContentMode,
    setMessage,
    setMinutesFromNow,
    setUnlockMode,
    setAbsoluteLocal,
    setTrigger,
    setDmsInterval,
    setMsSignersRaw,
    setMsThreshold,
    setRecipientsRaw,
    applyTemplate,
    handleFileChange,
    clearFile,
    handleSeal,
  };
}
