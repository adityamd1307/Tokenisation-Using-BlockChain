import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { useWallet } from "./WalletContext";
import { useData } from "./DataContext";
import { confirmTransaction, type TxState } from "../services/transactions";
import { errorMessage, rejected } from "../utils/errors";
import { blockchain } from "../services/blockchain";
interface Transactions {
  state: TxState;
  pending: boolean;
  run: (
    label: string,
    send: () => Promise<TransactionResponse>,
  ) => Promise<TransactionReceipt | undefined>;
  checkConfirmation: () => Promise<void>;
}
const Context = createContext<Transactions | null>(null);
export function TransactionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet(),
    { refresh } = useData();
  const [entry, setEntry] = useState<{ session: number; state: TxState }>({
    session: wallet.session,
    state: { phase: "idle" },
  });
  const session = useRef(wallet.session);
  session.current = wallet.session;
  const locks = useRef(new Set<number>());
  const state: TxState =
    entry.session === wallet.session ? entry.state : { phase: "idle" };
  const run: Transactions["run"] = async (label, send) => {
    const start = wallet.session;
    if (locks.current.has(start) || state.phase === "unconfirmed") return;
    const update = (state: TxState) => {
      if (session.current === start)
        setEntry({ session: start, state: { ...state, label } });
    };
    locks.current.add(start);
    try {
      if (!wallet.account || !wallet.provider)
        throw new Error("Connect your wallet first.");
      if (wallet.wrongNetwork)
        throw new Error(
          "Wrong network. Switch to the configured network first.",
        );
      update({ phase: "wallet" });
      const tx = await send();
      const receipt = await confirmTransaction(tx, (phase, hash) =>
        update({ phase, hash }),
      );
      refresh();
      return session.current === start ? receipt : undefined;
    } catch (error) {
      if (session.current === start)
        setEntry((previous) => ({
          session: start,
          state: {
            ...previous.state,
            label,
            phase:
              (error as { code?: string })?.code === "RECEIPT_UNCONFIRMED"
                ? "unconfirmed"
                : rejected(error)
                  ? "rejected"
                  : "failed",
            error: errorMessage(error),
          },
        }));
    } finally {
      locks.current.delete(start);
    }
  };
  const checkConfirmation = async () => {
    const start = wallet.session;
    if (!state.hash || locks.current.has(start)) return;
    locks.current.add(start);
    try {
      await blockchain.ready();
      const receipt = await blockchain.provider.getTransactionReceipt(
        state.hash,
      );
      if (session.current !== start) return;
      if (!receipt)
        setEntry({
          session: start,
          state: {
            ...state,
            error:
              "No receipt yet. The transaction may still be pending. Check your wallet and try checking confirmation again.",
          },
        });
      else {
        setEntry({
          session: start,
          state: {
            ...state,
            phase: receipt.status === 1 ? "confirmed" : "failed",
            error:
              receipt.status === 1
                ? undefined
                : "The transaction receipt reports a revert.",
          },
        });
        if (receipt.status === 1) refresh();
      }
    } catch (error) {
      if (session.current === start)
        setEntry({
          session: start,
          state: { ...state, error: errorMessage(error) },
        });
    } finally {
      locks.current.delete(start);
    }
  };
  return (
    <Context.Provider
      value={{
        state,
        pending: ["wallet", "submitted", "pending", "unconfirmed"].includes(
          state.phase,
        ),
        run,
        checkConfirmation,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTransaction() {
  const value = useContext(Context);
  if (!value) throw new Error("Transaction context missing");
  return value;
}
