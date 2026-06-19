"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RevealIndexPage() {
  const [id, setId] = useState("");
  const router = useRouter();

  function go() {
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/reveal/${trimmed}`);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Open a Capsule</h1>
      <p className="mb-8 text-sm text-muted-foreground">Enter a capsule ID to check its status.</p>

      <div className="flex gap-2">
        <Input
          placeholder="0x…"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="font-mono text-sm"
        />
        <Button onClick={go} disabled={!id.trim()}>
          <Search className="mr-1.5 h-4 w-4" />
          Open
        </Button>
      </div>
    </main>
  );
}
