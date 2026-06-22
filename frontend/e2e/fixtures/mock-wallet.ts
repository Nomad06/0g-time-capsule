import { test as base, expect, type Page } from "@playwright/test";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

/**
 * Mock injected wallet for Playwright.
 *
 * A node-side viem account signs/broadcasts; the in-page `window.ethereum`
 * EIP-1193 shim forwards every RPC to it. Reads hit the live 0G testnet RPC,
 * signatures are real (test privkey), no MetaMask extension needed.
 *
 * The app's wagmi config uses `injected()`, which picks up `window.ethereum`.
 */

export const CHAIN_ID = Number(process.env.E2E_CHAIN_ID ?? 16602);
export const RPC_URL =
  process.env.NEXT_PUBLIC_0G_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// Default: a throwaway key — fine for connect/read flows. Override with a
// funded key (E2E_TEST_PRIVKEY) for scenarios that actually broadcast txs.
const PRIVKEY = (process.env.E2E_TEST_PRIVKEY as Hex) ?? generatePrivateKey();

const SIGNING_METHODS = new Set([
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v1",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
]);

export interface MockWalletOptions {
  /** chainId the wallet reports initially (use a wrong one to test net-switch UX) */
  chainId?: number;
  /** report isMetaMask — set false to exercise the non-MetaMask switchChain path */
  isMetaMask?: boolean;
  privateKey?: Hex;
}

export interface MockWallet {
  address: Hex;
  /** Fire a wallet-side event into the page (e.g. simulate user disconnect). */
  emit: (event: string, ...args: unknown[]) => Promise<void>;
}

export async function installMockWallet(
  page: Page,
  opts: MockWalletOptions = {},
): Promise<MockWallet> {
  const account = privateKeyToAccount(opts.privateKey ?? PRIVKEY);
  const chainId = opts.chainId ?? CHAIN_ID;
  const isMetaMask = opts.isMetaMask ?? true;

  const transport = http(RPC_URL);
  const chain = {
    id: CHAIN_ID,
    name: "0G Testnet",
    nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  } as const;
  const pub = createPublicClient({ chain, transport });
  const wallet = createWalletClient({ account, chain, transport });

  // Node-side RPC handler — must be registered BEFORE the init script that
  // references window.__walletRpc.
  await page.exposeFunction(
    "__walletRpc",
    async ({ method, params }: { method: string; params?: any[] }) => {
      try {
        switch (method) {
          case "personal_sign": {
            // params = [dataHex, address]
            const data = params?.[0] as Hex;
            return await account.signMessage({ message: { raw: data } });
          }
          case "eth_sign": {
            // params = [address, dataHex]
            const data = params?.[1] as Hex;
            return await account.signMessage({ message: { raw: data } });
          }
          case "eth_signTypedData":
          case "eth_signTypedData_v1":
          case "eth_signTypedData_v3":
          case "eth_signTypedData_v4": {
            const json = params?.[1] ?? params?.[0];
            const typed = typeof json === "string" ? JSON.parse(json) : json;
            return await account.signTypedData(typed);
          }
          case "eth_sendTransaction": {
            const tx = params?.[0] ?? {};
            return await wallet.sendTransaction({
              account,
              to: tx.to,
              data: tx.data,
              value: tx.value ? BigInt(tx.value) : undefined,
            });
          }
          default:
            // Read-only passthrough to the live RPC.
            return await pub.request({ method: method as any, params: params as any });
        }
      } catch (err: any) {
        // Surface as an EIP-1193-ish error the page can catch.
        throw new Error(err?.shortMessage ?? err?.message ?? String(err));
      }
    },
  );

  await page.addInitScript(
    ({ address, chainIdHex, isMetaMask, signingMethods }) => {
      let currentChain = chainIdHex;
      const listeners: Record<string, Function[]> = {};
      const emit = (event: string, ...args: unknown[]) =>
        (listeners[event] ?? []).slice().forEach((h) => {
          try {
            h(...args);
          } catch {}
        });

      const provider: any = {
        isMetaMask,
        _isMockWallet: true,
        async request({ method, params }: { method: string; params?: any[] }) {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [address];
            case "eth_chainId":
              return currentChain;
            case "net_version":
              return String(parseInt(currentChain, 16));
            case "wallet_switchEthereumChain": {
              const target = params?.[0]?.chainId;
              if (target && target !== currentChain) {
                currentChain = target;
                emit("chainChanged", target);
              }
              return null;
            }
            case "wallet_addEthereumChain":
              return null;
            case "wallet_requestPermissions":
            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];
            default:
              // signing + reads both go to node
              return await (window as any).__walletRpc({ method, params });
          }
        },
        on(event: string, handler: Function) {
          (listeners[event] ??= []).push(handler);
          return provider;
        },
        removeListener(event: string, handler: Function) {
          listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
          return provider;
        },
        // Some connectors call these.
        removeAllListeners() {
          for (const k of Object.keys(listeners)) listeners[k] = [];
          return provider;
        },
      };

      (window as any).ethereum = provider;
      (window as any).__mockWalletEmit = emit;
      // Announce per EIP-6963 in case the connector listens for it.
      emit("connect", { chainId: currentChain });
    },
    {
      address: account.address,
      chainIdHex: `0x${chainId.toString(16)}`,
      isMetaMask,
      signingMethods: [...SIGNING_METHODS],
    },
  );

  return {
    address: account.address,
    emit: (event, ...args) =>
      page.evaluate(
        ([e, a]) => (window as any).__mockWalletEmit?.(e, ...(a as unknown[])),
        [event, args] as const,
      ),
  };
}

/** Click the connect button and wait for an address to render in the nav. */
export async function connect(page: Page) {
  // The app uses a single injected connector — clicking "Connect" auto-selects it.
  const connectBtn = page
    .getByRole("button", { name: /connect/i })
    .first();
  if (await connectBtn.isVisible().catch(() => false)) {
    await connectBtn.click();
    // A wallet-picker dialog may appear; click the injected/MetaMask entry if so.
    const picker = page.getByRole("button", { name: /metamask|injected|browser wallet/i }).first();
    if (await picker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await picker.click();
    }
  }
}

export const test = base.extend<{ wallet: MockWallet }>({
  wallet: async ({ page }, use) => {
    const w = await installMockWallet(page);
    await use(w);
  },
});

export { expect };
