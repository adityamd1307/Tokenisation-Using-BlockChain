import type { Eip1193Provider, TransactionReceipt } from "ethers";

/** The fields ethers v6 and EIP-1193 wallets put on a thrown error. */
export interface RpcErrorLike {
  code?: string | number;
  message?: string;
  shortMessage?: string;
  reason?: string;
  data?: unknown;
  cancelled?: boolean;
  receipt?: TransactionReceipt | null;
  info?: { error?: { code?: number; message?: string; data?: unknown } };
}
export const rpcError = (error: unknown): RpcErrorLike =>
  typeof error === "object" && error !== null ? (error as RpcErrorLike) : {};

type Listener = (...args: unknown[]) => void;
export interface WalletProvider extends Eip1193Provider {
  on?: (event: string, listener: Listener) => void;
  removeListener?: (event: string, listener: Listener) => void;
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
  /** AssetToken.paused() — spec-v1 §5 D5. */
  paused: boolean;
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
/** The connected wallet's standing in one fund. */
export interface FundAccess {
  assetId: string;
  eligible: boolean;
  compliance: boolean;
  tokenAdmin: boolean;
  /** AssetSale.issuer: the only caller of allocate/withdraw/close/recover. */
  saleIssuer: boolean;
}
export interface RegistryRow {
  address: string;
  eligible: boolean;
  balance: bigint;
  compliance: boolean;
  tokenAdmin: boolean;
  /** Block of the latest WhitelistUpdated for this address, if any. */
  changedBlock?: number;
}
export interface IssuerRow {
  address: string;
  authorised: boolean;
  changedBlock: number;
}
export interface Roles {
  admin: boolean;
  issuer: boolean;
}
export interface Activity {
  id: string;
  type: string;
  /** Extra label, e.g. the role named in a RoleGranted event (AUD-017). */
  detail?: string;
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
