/**
 * 0G Storage client — browser-safe wrapper over /api/storage/* routes.
 *
 * The SDK uses Node.js `fs`, so all actual SDK calls run in API route handlers
 * (server-side). This module sends HTTP requests to those routes.
 */

export interface UploadResult {
  rootHash: `0x${string}`;
  txHash:   string | null;
}

export async function uploadToStorage(data: Uint8Array): Promise<UploadResult> {
  const hex = `0x${Buffer.from(data).toString("hex")}`;

  const res = await fetch("/api/storage/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ data: hex }),
  });

  if (!res.ok) {
    const text = await res.text();
    let error = text;
    try { error = JSON.parse(text).error ?? text; } catch { /* not JSON */ }
    throw new Error(`Storage upload failed: ${error}`);
  }

  return res.json();
}

export async function downloadFromStorage(rootHash: `0x${string}`): Promise<Uint8Array> {
  const res = await fetch(`/api/storage/download?hash=${encodeURIComponent(rootHash)}`);

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      try { message = (JSON.parse(text) as { error?: string }).error ?? text; }
      catch { message = text || message; }
    } catch { /* network error — keep default */ }
    throw new Error(`Storage download failed: ${message}`);
  }

  const { data }: { data: string } = await res.json();
  return new Uint8Array(Buffer.from(data.startsWith("0x") ? data.slice(2) : data, "hex"));
}
