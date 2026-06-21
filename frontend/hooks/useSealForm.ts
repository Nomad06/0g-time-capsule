"use client";

import { useState, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sealCapsule } from "@/lib/capsule";
import { TriggerType } from "@/lib/types";
import type { SealResult, TriggerConfig } from "@/lib/types";

const MAX_FILE_MB = 50;

export interface SealFormState {
  // content
  contentMode:   "text" | "file";
  message:       string;
  fileDataUri:   string | null;
  fileName:      string;
  // trigger
  minutes:       number;
  triggerType:   TriggerType;
  dmsInterval:   number;
  msSigners:     string;
  msThreshold:   number;
  // derived
  msSignerCount: number;
  // async state
  result:  SealResult | null;
  status:  string;
  loading: boolean;
  sealed:  boolean;
  // refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface SealFormActions {
  setContentMode:  (v: "text" | "file") => void;
  setMessage:      (v: string) => void;
  setMinutes:      (v: number) => void;
  setTriggerType:  (v: TriggerType) => void;
  setDmsInterval:  (v: number) => void;
  setMsSigners:    (v: string) => void;
  setMsThreshold:  (v: number) => void;
  applyTemplate:   (tpl: { message: string; minutes: number }) => void;
  handleFileChange:(e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile:       () => void;
  handleSeal:      () => Promise<void>;
}

export function useSealForm(): SealFormState & SealFormActions {
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

  function applyTemplate(tpl: { message: string; minutes: number }) {
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

      const trigger: TriggerConfig | undefined =
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

  return {
    // state
    contentMode,
    message,
    fileDataUri,
    fileName,
    minutes,
    triggerType,
    dmsInterval,
    msSigners,
    msThreshold,
    msSignerCount,
    result,
    status,
    loading,
    sealed,
    fileInputRef,
    // actions
    setContentMode,
    setMessage,
    setMinutes,
    setTriggerType,
    setDmsInterval,
    setMsSigners,
    setMsThreshold,
    applyTemplate,
    handleFileChange,
    clearFile,
    handleSeal,
  };
}
