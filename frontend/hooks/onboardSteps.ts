/**
 * Pure onboarding step model — no React/wagmi/viem imports, so the gating logic
 * is unit-testable in isolation (see __tests__/useOnboardFlow.test.ts).
 */

/** The six onboarding steps, in order. The active step is the first not-done one. */
export type OnboardStepId = "connect" | "network" | "gas" | "key" | "seal" | "reveal";

/**
 * The active step is the first incomplete one, in order. Steps are strictly
 * sequential — a later step never activates while an earlier one is unmet.
 */
export function computeActiveStep(s: {
  isConnected:    boolean;
  onRightNetwork: boolean;
  hasGas:         boolean;
  keyDone:        boolean;
  sealDone:       boolean;
}): OnboardStepId {
  if (!s.isConnected)    return "connect";
  if (!s.onRightNetwork) return "network";
  if (!s.hasGas)         return "gas";
  if (!s.keyDone)        return "key";
  if (!s.sealDone)       return "seal";
  return "reveal";
}
