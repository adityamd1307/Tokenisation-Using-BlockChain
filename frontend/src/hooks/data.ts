// Keyed on-chain reads shared by the pages. Account-dependent keys include the
// wallet session, so a wallet or chain change never shows the previous account's
// data (AUD-009). Public registry reads keep their last value while refreshing.
import { useAssets, useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { blockchain } from "../services/blockchain";
import { assetHistory } from "../services/history";
import { investorRegistry, issuerDirectory } from "../services/registry";
import type { Asset } from "../types";
import { useAsync } from "./useAsync";

export { useAssets };

export function useFund(id: string | undefined) {
  const assets = useAssets();
  return { ...assets, fund: assets.data?.find((asset) => asset.id === id) };
}

/** True when the wallet is connected to the configured chain. */
export function useConnected() {
  const wallet = useWallet();
  return !!wallet.account && !wallet.wrongNetwork;
}

/** The connected wallet's balance, eligibility, allowance and roles in one fund. */
export function useAccountState(asset: Asset | undefined) {
  const wallet = useWallet(),
    { revision } = useData(),
    connected = useConnected();
  const scope = `account:${wallet.session}:${asset?.id}:`;
  return useAsync(
    `${scope}${revision}`,
    () => blockchain.account(asset!, wallet.account!),
    connected && !!asset,
    scope,
  );
}

/** Per-fund roles for every fund (navigation, role badge). */
export function useAccess() {
  const wallet = useWallet(),
    assets = useAssets(),
    { revision } = useData(),
    connected = useConnected();
  const ids = assets.data?.map((asset) => asset.id).join(",");
  const scope = `access:${wallet.session}:`;
  return useAsync(
    `${scope}${revision}:${ids}`,
    () => blockchain.access(assets.data!, wallet.account!),
    connected && !!assets.data,
    scope,
  );
}

export function useHoldings() {
  const wallet = useWallet(),
    assets = useAssets(),
    { revision } = useData(),
    connected = useConnected();
  const ids = assets.data?.map((asset) => asset.id).join(",");
  const scope = `holdings:${wallet.session}:`;
  return useAsync(
    `${scope}${revision}:${ids}`,
    () => blockchain.holdings(assets.data!, wallet.account!),
    connected && !!assets.data,
    scope,
  );
}

export function useHistory(assets: Asset[] | undefined, account?: string) {
  const { revision } = useData();
  const ids = assets?.map((asset) => asset.id).join(",");
  return useAsync(
    `history:${ids}:${account ?? "all"}:${revision}`,
    async () =>
      (
        await Promise.all(
          assets!.map((asset) => assetHistory(blockchain, asset, account)),
        )
      )
        .flat()
        .sort((a, b) => b.block - a.block || b.index - a.index),
    !!assets,
    true,
  );
}

export function useRegistry(asset: Asset | undefined) {
  const { revision } = useData();
  return useAsync(
    `registry:${asset?.id}:${revision}`,
    () => investorRegistry(blockchain, asset!),
    !!asset,
    true,
  );
}

export function useIssuerDirectory(enabled: boolean) {
  const { revision } = useData();
  return useAsync(
    `issuers:${revision}`,
    () => issuerDirectory(blockchain),
    enabled,
    true,
  );
}

/** Live whitelist status for an address typed into a form. */
export function useEligibility(asset: Asset | undefined, address: string) {
  const { revision } = useData();
  return useAsync(
    `eligibility:${asset?.id}:${address}:${revision}`,
    () => blockchain.eligibility(asset!, address),
    !!asset && !!address,
  );
}
