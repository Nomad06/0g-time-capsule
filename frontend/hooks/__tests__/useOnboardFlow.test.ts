import { describe, it, expect } from "vitest";
import { computeActiveStep } from "../onboardSteps";

const ALL_DONE = {
  isConnected:    true,
  onRightNetwork: true,
  hasGas:         true,
  keyDone:        true,
  sealDone:       true,
};

describe("computeActiveStep — sequential gating", () => {
  it("starts at connect when nothing is done", () => {
    expect(computeActiveStep({
      isConnected: false, onRightNetwork: false, hasGas: false, keyDone: false, sealDone: false,
    })).toBe("connect");
  });

  it("advances one step at a time as each prerequisite completes", () => {
    expect(computeActiveStep({ ...ALL_DONE, isConnected: false }) /* nothing else matters */).toBe("connect");
    expect(computeActiveStep({ ...ALL_DONE, onRightNetwork: false, hasGas: false, keyDone: false, sealDone: false })).toBe("network");
    expect(computeActiveStep({ ...ALL_DONE, hasGas: false, keyDone: false, sealDone: false })).toBe("gas");
    expect(computeActiveStep({ ...ALL_DONE, keyDone: false, sealDone: false })).toBe("key");
    expect(computeActiveStep({ ...ALL_DONE, sealDone: false })).toBe("seal");
    expect(computeActiveStep(ALL_DONE)).toBe("reveal");
  });

  it("never skips an earlier incomplete step even if a later one is done", () => {
    // Connected but no network, yet key+seal somehow flagged — must still gate on network.
    expect(computeActiveStep({
      isConnected: true, onRightNetwork: false, hasGas: true, keyDone: true, sealDone: true,
    })).toBe("network");
  });

  it("requires gas before key registration", () => {
    expect(computeActiveStep({
      isConnected: true, onRightNetwork: true, hasGas: false, keyDone: false, sealDone: false,
    })).toBe("gas");
  });
});
