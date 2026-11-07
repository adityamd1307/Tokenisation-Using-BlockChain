import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useAssets } from "./DataContext";

// The fund the sidebar links and the sidebar contract list refer to. Pages with a
// fund in the URL set it; it is remembered per browser as a convenience only.
const STORAGE_KEY = "assettoken:selected-fund";
const read = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

const FundContext = createContext<{
  selectedId: string | undefined;
  select: (id: string) => void;
}>({ selectedId: undefined, select: () => {} });

export function FundProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<string | undefined>(read);
  const select = useCallback((id: string) => {
    setStored(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* Storage may be unavailable; selection still works for this visit. */
    }
  }, []);
  return (
    <FundContext.Provider value={{ selectedId: stored, select }}>
      {children}
    </FundContext.Provider>
  );
}

/** The selected fund, falling back to the first registered fund. */
export function useSelectedFund() {
  const { selectedId, select } = useContext(FundContext);
  const assets = useAssets();
  const fund =
    assets.data?.find((asset) => asset.id === selectedId) ?? assets.data?.[0];
  return { fund, select, loading: assets.loading && !assets.data };
}
