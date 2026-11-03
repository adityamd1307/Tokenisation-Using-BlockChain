import { deployment } from "./contracts";

export const targetNetwork = {
  chainId: deployment.chainId,
  name:
    deployment.chainId === 31337
      ? "Local Ethereum"
      : `Ethereum · ${deployment.chainId}`,
  rpcUrl: import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545",
};
