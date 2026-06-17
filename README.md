# 0G Time Capsule

Seal any message on-chain. Lock it until a future date, a missed check-in, or a multi-sig vote. When revealed, the on-chain commitment proves the content was never changed — no trusted third party required.

Built on [0G Network](https://0g.ai) — EVM-compatible chain + decentralized storage.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│ Client (Next.js 14 App Router)                         │
│  • AES-256-GCM encryption (plaintext never leaves)     │
│  • secp256k1 ECIES per-recipient key encryption        │
│  • keccak256 commitment (proof-of-existence)           │
└────────────────┬───────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   0G Chain (EVM)    0G Storage
   - TimeCapsule.sol  - Ciphertext blob
   - KeyRegistry.sol  - Content-addressed by
   - DeadManSwitch     rootHash stored on-chain
   - MultiSigReveal
```

### Encryption model

1. Random 32-byte `dataKey` → AES-256-GCM encrypts plaintext → ciphertext to 0G Storage
2. `dataKey` wrapped under owner-signature-derived `wrapKey` (HKDF-SHA256) → `timelockHeader` stored on-chain
3. Per recipient: `dataKey` ECIES-encrypted to their registered secp256k1 pubkey → `setRecipientKeys()` on-chain
4. `commitHash = keccak256(plaintext)` stored at seal time → tamper-evidence at reveal

The contract refuses `reveal()` before `unlockTime`. No trusted party can decrypt early.

---

## Stages

| Stage | Description |
|-------|-------------|
| **0** | Foundation — contracts, crypto layer, wagmi/viem frontend |
| **1** | Proof-of-existence — `commitHash`, OG meta, public proof pages |
| **2** | Recipients — ECIES per-recipient key encryption, KeyRegistry |
| **3** | Triggers — Dead Man's Switch, Multi-Sig Reveal |
| **4** | Productize — landing page, onboarding, OG images, polished gallery |

---

## Contracts

| Contract | Description |
|----------|-------------|
| `TimeCapsule.sol` | Core registry — `seal()`, `reveal()`, `verify()`, recipient key storage |
| `KeyRegistry.sol` | On-chain secp256k1 pubkey registry for ECIES recipient encryption |
| `DeadManSwitch.sol` | Trigger: unlocks if owner misses check-in interval |
| `MultiSigReveal.sol` | Trigger: unlocks when M-of-N signers approve |

---

## Local setup

### Prerequisites

- Node.js 18+
- MetaMask (or any EVM wallet)

### Install

```bash
# Root — contracts + scripts
npm install

# Frontend
cd frontend && npm install
```

### Run tests

```bash
npm test
# 28 tests passing
```

### Compile contracts

```bash
npm run compile
```

### Stage 3 demo (local Hardhat)

```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/demo-stage3.ts --network localhost
```

### Deploy to 0G testnet

```bash
# Set DEPLOYER_PRIVATE_KEY in .env
npm run deploy:testnet
# → deployments/zerogTestnet.json
```

### Run frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in deployed contract addresses + storage keys
npm run dev
# → http://localhost:3000
```

---

## Frontend .env

```env
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_INDEXER_URL=https://indexer-storage-testnet-standard.0g.ai
STORAGE_PRIVATE_KEY=0x...           # Server wallet for storage fees

NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_TIME_CAPSULE_ADDRESS=0x...
NEXT_PUBLIC_KEY_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DEAD_MAN_SWITCH_ADDRESS=0x...
NEXT_PUBLIC_MULTI_SIG_REVEAL_ADDRESS=0x...
```

---

## User flows

### Seal a capsule
1. Connect wallet → `/onboard`
2. (Optional) Register encryption key → `/register`
3. Write message, pick trigger type, add recipients → `/seal`
4. Share `/proof/{capsuleId}` link — anyone can verify the commitment

### Reveal (owner)
- Visit `/proof/{capsuleId}` → click **Reveal & Decrypt**
- Signs `0g-time-capsule-reveal:{capsuleId}` to derive `wrapKey` → decrypts locally

### Reveal (recipient — Stage 2)
- Must have local private key (registered at `/register`)
- Visit `/proof/{capsuleId}` → click **Decrypt as recipient**
- ECIES-decrypts the stored envelope with local privkey → decrypts payload

### Dead Man's Switch (Stage 3)
- Seal with DEADMAN trigger → `/triggers/deadman/{capsuleId}`
- Call **Check In** periodically to reset deadline
- After deadline passes, anyone clicks **Trigger Switch** → **Reveal**

### Multi-Sig Reveal (Stage 3)
- Seal with MULTISIG trigger → `/triggers/multisig/{capsuleId}`
- Each designated signer clicks **Approve Reveal**
- When threshold reached, anyone clicks **Reveal Capsule**

---

## Trust model

| Property | How |
|----------|-----|
| Content tamper-proof | `commitHash = keccak256(plaintext)` on-chain at seal |
| Time-lock enforced | Contract rejects `reveal()` before `unlockTime` |
| No server decryption | Storage server only sees ciphertext; key never leaves client |
| Owner-only decrypt (base) | `wrapKey` derived from owner wallet signature via HKDF |
| Recipient-only decrypt | ECIES envelope on-chain; only registered privkey can open |
| Permissionless reveal | Anyone can call `reveal()` once condition is met |

---

## Tech stack

- **Solidity 0.8.24** — contracts (OpenZeppelin ReentrancyGuard)
- **Hardhat** — compile, test (Chai/Ethers), deploy
- **viem v2 + wagmi v2** — frontend chain interaction
- **ethers v6** — signer bridging
- **@noble/ciphers** — AES-256-GCM
- **@noble/curves** — secp256k1 ECIES
- **@noble/hashes** — HKDF-SHA256, keccak256
- **Next.js 14 App Router** — SSR OG meta, server API routes for 0G SDK
- **@0glabs/0g-ts-sdk** — storage upload/download (server-side only)
