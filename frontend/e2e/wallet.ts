// Test-only EIP-1193 wallet injected by Playwright. It is never bundled into the app.
// It answers account and chain requests itself and forwards everything else, including
// eth_sendTransaction, to the local Hardhat node, whose default accounts are unlocked.
// MetaMask itself is therefore not exercised by these tests.
import type { Browser, Page } from "@playwright/test";

export const accounts = {
  admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  issuer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  investor1: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  investor2: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  unapproved: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  outsider: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
} as const;

function inject({ account, chain }: { account: string; chain: string | null }) {
  const RPC = "http://127.0.0.1:8545";
  let override = chain;
  let nextId = 0;
  const listeners: Record<string, ((value: unknown) => void)[]> = {};
  const rpc = async (method: string, params: unknown[] = []) => {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, params }),
    });
    const body = await response.json();
    if (body.error)
      throw Object.assign(new Error(body.error.message), {
        code: body.error.code,
        data: body.error.data,
      });
    return body.result;
  };
  const provider = {
    async request({ method, params = [] }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account];
        case "eth_chainId":
          return override ?? rpc("eth_chainId");
        case "wallet_switchEthereumChain": {
          const target = (params[0] as { chainId: string }).chainId;
          override = target === "0x7a69" ? null : target;
          (listeners.chainChanged ?? []).forEach((f) => f(target));
          return null;
        }
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction":
          return rpc(method, [{ ...(params[0] as object), from: account }]);
        default:
          return rpc(method, params);
      }
    },
    on(event: string, listener: (value: unknown) => void) {
      (listeners[event] ??= []).push(listener);
    },
    removeListener(event: string, listener: (value: unknown) => void) {
      listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
    },
  };
  Object.defineProperty(window, "ethereum", { value: provider, configurable: true });
}

/** A page whose injected wallet controls `account`, optionally on another chain. */
export async function walletPage(
  browser: Browser,
  account: string,
  options: { chain?: string; width?: number; height?: number } = {},
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
  });
  await context.addInitScript(inject, { account, chain: options.chain ?? null });
  return context.newPage();
}

/** A page with no wallet installed at all. */
export async function noWalletPage(browser: Browser, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  return context.newPage();
}

/**
 * Client-side navigation, like clicking a link. A full page load would drop the
 * wallet session, because the app (old and new) does not reconnect on load.
 */
export async function nav(page: Page, path: string) {
  if (!page.url().startsWith("http")) {
    await page.goto(path);
    return;
  }
  await page.evaluate((to) => {
    // Same state shape React Router writes, so each navigation gets a new key.
    const key = Math.random().toString(36).slice(2, 10);
    window.history.pushState({ usr: null, key, idx: Date.now() }, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

export async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect wallet" }).first().click();
  await page.getByRole("button", { name: "Disconnect wallet" }).waitFor();
}
