import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { targetNetwork } from "../config/networks";
import { eth } from "../utils/formatting";
import { Address, ErrorMessage } from "./common";
export function WalletControls() {
  const wallet = useWallet();
  const [selected, setSelected] = useState("");
  return (
    <div className="wallet-controls">
      {wallet.account ? (
        <>
          <div className="wallet-account">
            <span className="wallet-dot" />
            <Address value={wallet.account} />
          </div>
          <button className="text-button" onClick={wallet.disconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          {wallet.options.length > 1 && (
            <select
              aria-label="Wallet provider"
              value={selected || wallet.options[0].id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {wallet.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="button"
            disabled={wallet.busy}
            onClick={() => void wallet.connect(selected)}
          >
            {wallet.busy ? "Connecting…" : "Connect Wallet"}
            <span aria-hidden> ↗</span>
          </button>
        </>
      )}
    </div>
  );
}
export function WalletNotices() {
  const wallet = useWallet();
  return (
    <>
      {wallet.error && (
        <ErrorMessage message={wallet.error} retry={wallet.refresh} />
      )}
      {wallet.wrongNetwork && (
        <div role="alert" className="notice warning">
          <div>
            <strong>Switch network to continue</strong>
            <p>
              Current: chain {wallet.chainId}. Required: {targetNetwork.name} (
              {targetNetwork.chainId}).
            </p>
          </div>
          <button
            className="button secondary"
            disabled={wallet.busy}
            onClick={() => void wallet.switchChain()}
          >
            Switch Network
          </button>
        </div>
      )}
    </>
  );
}
export function WalletSummary() {
  const wallet = useWallet();
  return (
    <div className="wallet-summary">
      <span className="eyebrow">Wallet overview</span>
      {wallet.account ? (
        <>
          <Address value={wallet.account} />
          <span>
            {wallet.wrongNetwork
              ? `Chain ${wallet.chainId}`
              : targetNetwork.name}
          </span>
          <strong>
            {wallet.ethBalance === null ? "—" : `${eth(wallet.ethBalance)} ETH`}
          </strong>
          <span>
            {wallet.wrongNetwork
              ? "Unsupported network"
              : wallet.roles
                ? [
                    wallet.roles.admin && "Platform administrator",
                    wallet.roles.issuer && "Authorised issuer",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Investor"
                : "Checking platform roles…"}
          </span>
        </>
      ) : (
        <>
          <strong>Explore without a wallet</strong>
          <span>Connect to manage assets and view your holdings.</span>
        </>
      )}
    </div>
  );
}
