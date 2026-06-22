# E2E tests (Playwright)

End-to-end specs for the 🔴 manual rows in [`docs/test-scenarios.md`](../../docs/test-scenarios.md).
They drive the real app against the live 0G testnet RPC using a **mock injected
wallet** — no MetaMask extension, no funded account for read/connect flows.

## ⚠️ Node version

Playwright's loader is **broken on Node 23** (`context.conditions?.includes is not
a function` on any relative import). Use **Node 18/20/22 LTS** — see `.nvmrc` (22).

```bash
nvm use            # picks up .nvmrc → Node 22
```

## Run

```bash
cd frontend
npm run e2e                 # auto-starts `npm run dev`, runs chromium + mobile
npm run e2e -- --project=chromium
npm run e2e:ui              # interactive
npm run e2e:report          # open last HTML report
```

Reuse an already-running dev server:

```bash
E2E_NO_SERVER=1 npm run e2e
```

Requires `.env.local` with `NEXT_PUBLIC_TIME_CAPSULE_ADDRESS` + RPC (already set
for this repo).

## How the mock wallet works

`e2e/fixtures/mock-wallet.ts` injects an EIP-1193 `window.ethereum` before page
load. The app's `injected()` wagmi connector picks it up. Reads and signatures
are forwarded to a **node-side viem account** (real secp256k1 signing); chain
reads hit the live RPC.

- `installMockWallet(page, { chainId?, isMetaMask?, privateKey? })` — install per page.
- `wallet` fixture — auto-installs with a throwaway key.
- `connect(page)` — clicks Connect + picks the injected connector.
- `wallet.emit(event, ...)` — fire wallet events (e.g. `accountsChanged`, `disconnect`).

### Env knobs

| Var | Purpose |
|-----|---------|
| `E2E_TEST_PRIVKEY` | Funded key for specs that **broadcast** txs (seal/reveal/check-in). Default = random throwaway (connect/read only). |
| `E2E_REGISTERED_PRIVKEY` | Pre-registered+funded key to un-`fixme` scenario 2.3. |
| `NEXT_PUBLIC_0G_RPC_URL` | RPC the mock forwards reads to. |
| `E2E_CHAIN_ID` | Override chain id (default 16602). |

## Coverage

Maps to `docs/test-scenarios.md` 🔴 rows: wallet connect/disconnect/persistence
+ non-MetaMask no-crash (1.x), proof public view/OG/not-found (4.x), discover
(9.x), stats (10.1), NFT API (11.x), gallery empty/feed/filter (8.x), AI assist
(3.6), responsive + loading (12.2/12.3). Scenario 2.3 is `test.fixme` pending a
registered funded account.

**Not covered here** (need funded broadcasts or two wallets — future tier):
full seal→reveal, recipient ECIES decrypt, dead-man check-in/trigger, multisig
approve→reveal, NFT mint.
