import { createContext, useContext, useState, type ReactNode } from "react";
import { blockchain } from "../services/blockchain";
import { useAsync } from "../hooks/useAsync";
import { useWallet } from "./WalletContext";
const DataContext = createContext<{ revision: number; refresh: () => void }>({
  revision: 0,
  refresh: () => {},
});
export function DataProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const wallet = useWallet();
  return (
    <DataContext.Provider
      value={{
        revision,
        refresh: () => {
          setRevision((r) => r + 1);
          wallet.refresh();
        },
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export const useData = () => useContext(DataContext);
// Only public registry data is retained during refresh. Account reads always invalidate.
export function useAssets() {
  const { revision } = useData();
  return useAsync(
    `registry:${revision}`,
    () => blockchain.assets(),
    true,
    true,
  );
}
