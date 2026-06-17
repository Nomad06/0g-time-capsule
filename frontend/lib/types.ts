// Mirrors TimeCapsule.sol enums / structs

export const TriggerType = {
  TIME:     0,
  DEADMAN:  1,
  ORACLE:   2,
  MULTISIG: 3,
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

export const CapsuleState = {
  SEALED:   0,
  REVEALED: 1,
} as const;
export type CapsuleState = (typeof CapsuleState)[keyof typeof CapsuleState];

export interface OnChainCapsule {
  owner:           `0x${string}`;
  unlockTime:      bigint;   // unix seconds
  unlockBlock:     bigint;
  storageRoot:     `0x${string}`;  // 0G Storage root hash
  commitHash:      `0x${string}`;  // keccak256(plaintext)
  timelockHeader:  `0x${string}`;  // drand-timelocked sym key
  triggerType:     TriggerType;
  triggerContract: `0x${string}`;
  recipients:      `0x${string}`[];
  state:           CapsuleState;
  createdAt:       bigint;
}

// ── Seal params ───────────────────────────────────────────────────────────────

export interface RecipientParam {
  address: `0x${string}`;
  pubkey:  Uint8Array;   // 33-byte compressed secp256k1 from KeyRegistry
}

// Stage 3: trigger configs ─────────────────────────────────────────────────────

export interface DeadManSwitchConfig {
  intervalDays: number;   // days between required check-ins
}

export interface MultiSigConfig {
  signers:   `0x${string}`[];
  threshold: number;
}

export interface SealParams {
  plaintext:        string;               // UTF-8 message
  unlockTime:       Date;                 // JS Date → unix timestamp on-chain
  recipients?:      RecipientParam[];     // empty = public; Stage 2: each gets ECIES key
  triggerType?:     TriggerType;
  triggerContract?: `0x${string}`;
  deadman?:         DeadManSwitchConfig;  // required when triggerType === DEADMAN
  multisig?:        MultiSigConfig;       // required when triggerType === MULTISIG
}

// ── Trigger state views ───────────────────────────────────────────────────────

export interface SwitchInfo {
  owner:       `0x${string}`;
  interval:    bigint;
  lastCheckin: bigint;
  triggered:   boolean;
  revealed:    boolean;
  deadline:    bigint;    // lastCheckin + interval
  overdue:     boolean;
}

export interface VaultInfo {
  owner:         `0x${string}`;
  threshold:     number;
  approvalCount: number;
  revealed:      boolean;
  signers:       `0x${string}`[];
}

export interface SealResult {
  capsuleId:     `0x${string}`;
  storageRoot:   `0x${string}`;
  commitHash:    `0x${string}`;
  drandRound:    number;
  txHash:        `0x${string}`;
}

// ── Reveal params ─────────────────────────────────────────────────────────────

export interface RevealResult {
  capsuleId:   `0x${string}`;
  plaintext:   string;
  commitHash:  `0x${string}`;
  verified:    boolean;   // on-chain hash matched revealed plaintext
}

// ── Encrypted payload stored on 0G ───────────────────────────────────────────

// Blob layout stored on 0G Storage:
//   [0..11]  nonce (12 bytes, AES-GCM)
//   [12..]   AES-GCM ciphertext + 16-byte auth tag
export interface EncryptedBlob {
  nonce:      Uint8Array; // 12 bytes
  ciphertext: Uint8Array; // plaintext length + 16-byte GCM tag
}
