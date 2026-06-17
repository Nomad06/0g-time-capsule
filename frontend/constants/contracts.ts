import { defineChain } from "viem";

// ── 0G Testnet chain definition ───────────────────────────────────────────────

export const zeroGTestnet = defineChain({
  id: 16600,
  name: "0G Testnet",
  nativeCurrency: { name: "0G Testnet Token", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_0G_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "0G Explorer",
      url: "https://chainscan-galileo.0g.ai",
    },
  },
  testnet: true,
});

// ── Contract addresses ────────────────────────────────────────────────────────
// Populated from deployments/zerogTestnet.json after `npm run deploy:testnet`

export const CONTRACT_ADDRESSES = {
  TimeCapsule:    (process.env.NEXT_PUBLIC_TIME_CAPSULE_ADDRESS    ?? "0x") as `0x${string}`,
  DeadManSwitch:  (process.env.NEXT_PUBLIC_DEAD_MAN_SWITCH_ADDRESS ?? "0x") as `0x${string}`,
  MultiSigReveal: (process.env.NEXT_PUBLIC_MULTI_SIG_REVEAL_ADDRESS ?? "0x") as `0x${string}`,
  KeyRegistry:    (process.env.NEXT_PUBLIC_KEY_REGISTRY_ADDRESS    ?? "0x") as `0x${string}`,
} as const;

// ── ABIs (minimal — only functions we call from the frontend) ─────────────────

export const TIME_CAPSULE_ABI = [
  // seal
  {
    name: "seal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "storageRoot",      type: "bytes32" },
      { name: "commitHash",       type: "bytes32" },
      { name: "timelockHeader",   type: "bytes"   },
      { name: "unlockTime",       type: "uint64"  },
      { name: "unlockBlock",      type: "uint64"  },
      { name: "recipients",       type: "address[]" },
      { name: "triggerType",      type: "uint8"   },
      { name: "triggerContract",  type: "address" },
    ],
    outputs: [{ name: "capsuleId", type: "bytes32" }],
  },
  // reveal
  {
    name: "reveal",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "capsuleId", type: "bytes32" }],
    outputs: [],
  },
  // verify
  {
    name: "verify",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "capsuleId", type: "bytes32" }, { name: "plaintextHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // isUnlocked
  {
    name: "isUnlocked",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "capsuleId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // getCapsule
  {
    name: "getCapsule",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "capsuleId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner",           type: "address"   },
          { name: "unlockTime",      type: "uint64"    },
          { name: "unlockBlock",     type: "uint64"    },
          { name: "storageRoot",     type: "bytes32"   },
          { name: "commitHash",      type: "bytes32"   },
          { name: "timelockHeader",  type: "bytes"     },
          { name: "triggerType",     type: "uint8"     },
          { name: "triggerContract", type: "address"   },
          { name: "recipients",      type: "address[]" },
          { name: "state",           type: "uint8"     },
          { name: "createdAt",       type: "uint64"    },
        ],
      },
    ],
  },
  // getOwnerCapsules
  {
    name: "getOwnerCapsules",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  // getRecipientCapsules
  {
    name: "getRecipientCapsules",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "recipient", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  // events
  {
    name: "CapsuleSealed",
    type: "event",
    inputs: [
      { name: "capsuleId",   type: "bytes32", indexed: true  },
      { name: "owner",       type: "address", indexed: true  },
      { name: "unlockTime",  type: "uint64",  indexed: false },
      { name: "unlockBlock", type: "uint64",  indexed: false },
      { name: "commitHash",  type: "bytes32", indexed: false },
      { name: "triggerType", type: "uint8",   indexed: false },
    ],
  },
  {
    name: "CapsuleRevealed",
    type: "event",
    inputs: [
      { name: "capsuleId",      type: "bytes32", indexed: true  },
      { name: "revealer",       type: "address", indexed: true  },
      { name: "timelockHeader", type: "bytes",   indexed: false },
    ],
  },
  // Stage 2
  {
    name: "setRecipientKeys",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "capsuleId",    type: "bytes32"   },
      { name: "recipients",   type: "address[]" },
      { name: "encryptedKeys", type: "bytes[]"  },
    ],
    outputs: [],
  },
  {
    name: "getRecipientKey",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capsuleId",  type: "bytes32" },
      { name: "recipient",  type: "address" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "RecipientKeySet",
    type: "event",
    inputs: [
      { name: "capsuleId",  type: "bytes32", indexed: true },
      { name: "recipient",  type: "address", indexed: true },
    ],
  },
] as const;

// ── KeyRegistry ABI ───────────────────────────────────────────────────────────

export const KEY_REGISTRY_ABI = [
  {
    name: "registerKey",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "pubkey", type: "bytes" }],
    outputs: [],
  },
  {
    name: "getKey",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "hasKey",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "KeyRegistered",
    type: "event",
    inputs: [
      { name: "wallet", type: "address", indexed: true  },
      { name: "pubkey", type: "bytes",   indexed: false },
    ],
  },
] as const;
