// Client helper for the gas-drip relayer. Call ensureGas(address) before a
// write tx (seal, registerKey) so brand-new embedded-wallet users never have to
// visit the faucet. The server only tops up addresses that are near-empty and
// rate-limits per IP, so calling this defensively before every write is safe.

import { toast } from "sonner";

export interface DripResult {
  funded: boolean;
  txHash: string | null;
  skipped?: string;
}

export async function ensureGas(address: string): Promise<DripResult> {
  // The drip waits for one confirmation, so this can take a couple seconds.
  // Show a transient toast only while we're actually requesting it.
  const toastId = toast.loading("Adding test gas — no faucet needed…");
  try {
    const res = await fetch("/api/relay/drip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!res.ok) {
      // Non-fatal: the user may already have gas, or the faucet is rate-limited.
      // Let the caller proceed; the wallet will surface an "insufficient funds"
      // error only if they genuinely have none.
      const { error } = await res.json().catch(() => ({ error: "drip failed" }));
      toast.dismiss(toastId);
      return { funded: false, txHash: null, skipped: error };
    }

    const result = (await res.json()) as DripResult;
    if (result.txHash) {
      toast.success("Gas added — you're ready to go", { id: toastId });
    } else {
      toast.dismiss(toastId);
    }
    return result;
  } catch (e) {
    toast.dismiss(toastId);
    throw e;
  }
}
