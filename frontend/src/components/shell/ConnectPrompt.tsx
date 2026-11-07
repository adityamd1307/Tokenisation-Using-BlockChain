import { useWallet } from "../../context/WalletContext";
import { targetNetwork } from "../../config/networks";
import { Notice } from "../ui/layout";
import { WalletConnect } from "./TopBar";

/**
 * Shown in place of account-dependent content when no wallet is connected or the
 * wallet is on the wrong chain. Returns null when the wallet is ready.
 */
export function ConnectPrompt({ purpose }: { purpose: string }) {
  const wallet = useWallet();
  if (!wallet.account)
    return (
      <Notice
        title="No wallet connected"
        action={<WalletConnect />}
      >{`Connect a wallet to ${purpose}.`}</Notice>
    );
  if (wallet.wrongNetwork)
    return (
      <Notice
        tone="warn"
        title={`Switch to ${targetNetwork.name}`}
        action={
          <button
            className="btn btn--secondary"
            disabled={wallet.busy}
            onClick={() => void wallet.switchChain()}
          >
            Switch network
          </button>
        }
      >{`Your wallet is on chain ${wallet.chainId}. Switch to chain ${targetNetwork.chainId} to ${purpose}.`}</Notice>
    );
  return null;
}
