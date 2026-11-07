import { createContext, useContext, useState, type ReactNode } from "react";
import { blockchain } from "../services/blockchain";
import { useAsync } from "../hooks/useAsync";
import { useWallet } from "./WalletContext";
import type { Asset, FundAccess } from "../types";

type Read<T> = ReturnType<typeof useAsync<T>>;
interface Data {
  revision: number;
  refresh: () => void;
  /** Re-reads only the public fund registry (prices, inventory, paused, closed). */
  refreshRegistry: () => void;
  /** The fund registry, read once and shared by the shell and every page. */
  assets: Read<Asset[]>;
  /** The connected wallet's per-fund roles, read once and shared. */
  access: Read<FundAccess[]>;
}
const DataContext = createContext<Data | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  // Other users' actions (e.g. an issuer pausing) change fund state; the public
  // registry is re-read on every navigation so pre-flight checks are not stale.
  const [tick, setTick] = useState(0);
  const wallet = useWallet();
  // Only public registry data is retained during refresh. Account reads always invalidate.
  const assets = useAsync(
    `registry:${revision}:${tick}`,
    () => blockchain.assets(),
    true,
    true,
  );
  const connected = !!wallet.account && !wallet.wrongNetwork;
  const ids = assets.data?.map((asset) => asset.id).join(",");
  const scope = `access:${wallet.session}:`;
  const access = useAsync(
    `${scope}${revision}:${ids}`,
    () => blockchain.access(assets.data!, wallet.account!),
    connected && !!assets.data,
    scope,
  );
  return (
    <DataContext.Provider
      value={{
        revision,
        refresh: () => {
          setRevision((r) => r + 1);
          wallet.refresh();
        },
        refreshRegistry: () => setTick((t) => t + 1),
        assets,
        access,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("Data context missing");
  return value;
}
export const useAssets = () => useData().assets;
export const useAccess = () => useData().access;
