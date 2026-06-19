"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  onDraft: (text: string) => void;
  template?: string;
  className?: string;
}

export function AiAssistant({ onDraft, template, className }: Props) {
  const [open,   setOpen]   = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai-assist", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ prompt, template }),
      });
      const data = await res.json() as { text?: string; error?: string; provider?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "AI request failed");
      if (!data.text) throw new Error("Empty response");
      onDraft(data.text);
      setProvider(data.provider ?? null);
      setOpen(false);
      toast.success("Draft generated", {
        description: data.provider === "0g-compute"
          ? "Powered by 0G Compute Network"
          : "Powered by AI",
      });
    } catch (e: unknown) {
      toast.error("AI failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-indigo-800/60 bg-indigo-950/30 px-3 py-1 text-xs text-indigo-400 transition-colors hover:border-indigo-600 hover:text-indigo-300",
          className
        )}
      >
        <Sparkles className="h-3 w-3" />
        AI assist
        {provider === "0g-compute" && (
          <span className="ml-1 rounded bg-indigo-900 px-1 py-0.5 text-[9px] font-bold tracking-wider text-indigo-300">
            0G
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={cn("rounded-lg border border-indigo-800/60 bg-indigo-950/20 p-4", className)}>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-400">AI Capsule Assistant</span>
        <span className="ml-auto rounded bg-indigo-900/60 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-indigo-400">
          0G COMPUTE
        </span>
      </div>
      <Textarea
        rows={3}
        placeholder="Describe what you want to seal… e.g. 'A letter to my daughter for her 18th birthday, reflecting on today and my hopes for her future'"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={loading}
        className="mb-3 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          {loading ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…</>
          ) : (
            <><Send className="mr-1.5 h-3.5 w-3.5" /> Generate draft</>
          )}
        </Button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground/40">⌘+Enter to generate</span>
      </div>
    </div>
  );
}
