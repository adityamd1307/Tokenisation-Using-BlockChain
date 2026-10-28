import { parseEther } from "ethers";
import { vi } from "vitest";
import type { Asset, AssetAccount, WalletProvider } from "../types";
export const ADMIN = "0x1000000000000000000000000000000000000001";
export const ISSUER = "0x2000000000000000000000000000000000000002";
export const INVESTOR = "0x3000000000000000000000000000000000000003";
export const RECIPIENT = "0x4000000000000000000000000000000000000004";
export const TOKEN = "0x5000000000000000000000000000000000000005";
export const SALE = "0x6000000000000000000000000000000000000006";
export const FACTORY = "0x7000000000000000000000000000000000000007";
export const HASH = `0x${"ab".repeat(32)}`;
export const asset: Asset = {
  id: "0",
  name: "Campus Property Token",
  symbol: "CPT",
  description: "Simulated campus property fund",
  category: 0,
  totalSupply: 10000n,
  token: TOKEN,
  sale: SALE,
  issuer: ISSUER,
  price: parseEther("0.001"),
  inventory: 5000n,
  closed: false,
  proceeds: 0n,
  saleEth: 0n,
};
export const digital: Asset = {
  ...asset,
  id: "1",
  name: "Digital Licensing Token",
  symbol: "DLT",
  description: "Simulated digital licensing portfolio",
  category: 1,
  token: RECIPIENT,
  sale: FACTORY,
  price: parseEther("0.002"),
  totalSupply: 5000n,
};
export const accountState: AssetAccount = {
  balance: 100n,
  eligible: true,
  saleEligible: true,
  allowance: 0n,
  compliance: false,
  tokenAdmin: false,
};
export function mockTransaction(status = 1) {
  return {
    hash: HASH,
    wait: vi.fn().mockResolvedValue({ hash: HASH, status, logs: [] }),
  };
}
export class MockWallet implements WalletProvider {
  accounts = [INVESTOR];
  chain = "0x7a69";
  isMetaMask = true;
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  request = vi.fn(
    async ({ method, params }: { method: string; params?: any }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts")
        return this.accounts;
      if (method === "eth_chainId") return this.chain;
      if (method === "wallet_switchEthereumChain") {
        this.chain = params[0].chainId;
        this.emit("chainChanged", this.chain);
        return null;
      }
      if (method === "wallet_addEthereumChain") return null;
      throw new Error(`Unexpected mock wallet method ${method}`);
    },
  );
  on = (event: string, listener: (...args: any[]) => void) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  };
  removeListener = (event: string, listener: (...args: any[]) => void) => {
    this.listeners.get(event)?.delete(listener);
  };
  emit(event: string, value?: any) {
    this.listeners.get(event)?.forEach((listener) => listener(value));
  }
}
