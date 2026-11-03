import type { Eip1193Provider } from "ethers";

export interface WalletProvider extends Eip1193Provider {
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  providers?: WalletProvider[];
  isMetaMask?: boolean;
}
export interface WalletOption {
  id: string;
  name: string;
  provider: WalletProvider;
}
declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  description: string;
  category: number;
  totalSupply: bigint;
  token: string;
  sale: string;
  issuer: string;
  price: bigint;
  inventory: bigint;
  closed: boolean;
  proceeds: bigint;
  saleEth: bigint;
}
export interface Holding {
  asset: Asset;
  balance: bigint;
  eligible: boolean;
}
export interface AssetAccount {
  balance: bigint;
  eligible: boolean;
  saleEligible: boolean;
  allowance: bigint;
  compliance: boolean;
  tokenAdmin: boolean;
}
export interface Roles {
  admin: boolean;
  issuer: boolean;
}
export interface Activity {
  id: string;
  type: string;
  asset: string;
  quantity?: bigint;
  paid?: bigint;
  from?: string;
  to?: string;
  hash: string;
  block: number;
  index: number;
  timestamp?: number;
}
