import { deployment } from "./contracts";

// Read RPC per chain. Phase 4 §10: never put secrets in Vite variables, because they are compiled
// into the browser bundle. Phase 5 D16: Sepolia reads go to PublicNode's keyless endpoint.
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const LOCAL_RPC = "http://127.0.0.1:8545";

const known: Record<number, { name: string; rpcUrl: string }> = {
  31337: { name: "Local Ethereum", rpcUrl: LOCAL_RPC },
  [SEPOLIA_CHAIN_ID]: { name: "Sepolia testnet", rpcUrl: SEPOLIA_PUBLIC_RPC },
};

// VITE_RPC_URL overrides the default for the deployment's chain.
export function networkFor(chainId: number, rpcOverride?: string) {
  const entry = known[chainId];
  return {
    chainId,
    name: entry?.name ?? `Ethereum · ${chainId}`,
    rpcUrl: rpcOverride || entry?.rpcUrl || LOCAL_RPC,
  };
}

export const targetNetwork = networkFor(
  deployment.chainId,
  import.meta.env.VITE_RPC_URL,
);
