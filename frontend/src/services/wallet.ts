import { toQuantity } from "ethers";
import { targetNetwork } from "../config/networks";
import type { WalletProvider } from "../types";
export async function walletSnapshot(
  provider: WalletProvider,
  connect = false,
) {
  const accounts: string[] = await provider.request({
    method: connect ? "eth_requestAccounts" : "eth_accounts",
  });
  const chain = await provider.request({ method: "eth_chainId" });
  return { account: accounts[0] || null, chainId: Number(BigInt(chain)) };
}
export async function switchNetwork(provider: WalletProvider) {
  const chainId = toQuantity(targetNetwork.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error: any) {
    if (error?.code !== 4902 && error?.info?.error?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: targetNetwork.name,
          rpcUrls: [targetNetwork.rpcUrl],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }
}
