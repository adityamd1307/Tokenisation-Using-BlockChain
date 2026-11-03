import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { blockchain } from "../services/blockchain";
import { switchNetwork, walletSnapshot } from "../services/wallet";
import { targetNetwork } from "../config/networks";
import { errorMessage } from "../utils/errors";
import type { Roles, WalletOption, WalletProvider } from "../types";

interface WalletState {
  account: string | null;
  chainId: number | null;
  provider: WalletProvider | null;
  session: number;
  roles: Roles | null;
  ethBalance: bigint | null;
  error: string;
  busy: boolean;
}
const initial: WalletState = {
  account: null,
  chainId: null,
  provider: null,
  session: 0,
  roles: null,
  ethBalance: null,
  error: "",
  busy: false,
};
interface WalletValue extends WalletState {
  options: WalletOption[];
  wrongNetwork: boolean;
  connect: (id?: string) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  refresh: () => void;
}
const WalletContext = createContext<WalletValue | null>(null);
export function WalletProviderContext({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const selected = useRef<WalletProvider | null>(null);
  const invalidate = useCallback((provider: WalletProvider | null) => {
    const session = ++generation.current;
    setState({ ...initial, provider, session, busy: !!provider });
    return session;
  }, []);
  const sync = useCallback(
    async (provider: WalletProvider, request = false) => {
      selected.current = provider;
      const session = invalidate(provider);
      try {
        const snapshot = await walletSnapshot(provider, request);
        if (generation.current === session)
          setState((previous) => ({ ...previous, ...snapshot, busy: false }));
      } catch (error) {
        if (generation.current === session)
          setState((previous) => ({
            ...previous,
            busy: false,
            error: errorMessage(error),
          }));
      }
    },
    [invalidate],
  );
  useEffect(() => {
    const add = (option: WalletOption) =>
      setOptions((previous) =>
        previous.some((p) => p.provider === option.provider)
          ? previous
          : [...previous, option],
      );
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.provider?.request && detail.info?.uuid)
        add({
          id: detail.info.uuid,
          name: detail.info.name,
          provider: detail.provider,
        });
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    (
      window.ethereum?.providers || (window.ethereum ? [window.ethereum] : [])
    ).forEach((provider, index) =>
      add({
        id: `injected-${index}`,
        name: provider.isMetaMask ? "MetaMask" : `Browser wallet ${index + 1}`,
        provider,
      }),
    );
    return () =>
      window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  useEffect(() => {
    const provider = state.provider;
    if (!provider) return;
    const changed = () => {
      void sync(provider);
    };
    const disconnected = () => {
      selected.current = null;
      invalidate(null);
    };
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", changed);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("chainChanged", changed);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [state.provider, sync, invalidate]);
  useEffect(() => {
    if (!state.account || state.chainId !== targetNetwork.chainId) return;
    const session = state.session;
    let cancelled = false;
    Promise.all([
      blockchain.roles(state.account),
      blockchain.provider.getBalance(state.account),
    ])
      .then(([roles, ethBalance]) => {
        if (!cancelled && generation.current === session)
          setState((previous) => ({
            ...previous,
            roles,
            ethBalance,
            error: "",
          }));
      })
      .catch((error) => {
        if (!cancelled && generation.current === session)
          setState((previous) => ({
            ...previous,
            roles: null,
            ethBalance: null,
            error: errorMessage(error),
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [state.account, state.chainId, state.session, revision]);
  const connect = async (id?: string) => {
    const option = options.find((o) => o.id === id) || options[0];
    if (!option) {
      setState((previous) => ({
        ...previous,
        error:
          "No compatible wallet found. Install or enable MetaMask (or another EIP-1193 browser wallet), then reload this page.",
      }));
      return;
    }
    await sync(option.provider, true);
  };
  const disconnect = () => {
    selected.current = null;
    invalidate(null);
  };
  const switchChain = async () => {
    const provider = selected.current;
    if (!provider) return;
    setState((previous) => ({ ...previous, busy: true, error: "" }));
    try {
      await switchNetwork(provider);
      if (selected.current === provider) await sync(provider);
    } catch (error) {
      if (selected.current === provider)
        setState((previous) => ({
          ...previous,
          busy: false,
          error: errorMessage(error),
        }));
    }
  };
  return (
    <WalletContext.Provider
      value={{
        ...state,
        options,
        wrongNetwork:
          state.chainId !== null && state.chainId !== targetNetwork.chainId,
        connect,
        disconnect,
        switchChain,
        refresh: () => setRevision((r) => r + 1),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("Wallet context missing");
  return value;
}
