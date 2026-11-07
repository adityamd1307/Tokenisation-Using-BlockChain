import { SingaporeClock } from "./SingaporeClock";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { targetNetwork } from "../../config/networks";
import { useRoleBadge } from "../../hooks/useRole";
import { Address, Pill } from "../ui/display";

const sections: [RegExp, string, string][] = [
  [/^\/$/, "Marketplace", "Fund registry"],
  [/^\/funds\/[^/]+$/, "Marketplace", "Fund overview"],
  [/^\/funds\/[^/]+\/subscribe$/, "Marketplace", "Subscribe"],
  [/^\/funds\/[^/]+\/transfer$/, "My portfolio", "Transfer"],
  [/^\/portfolio/, "My portfolio", "Holdings"],
  [/^\/activity/, "My portfolio", "Activity"],
  [/^\/compliance/, "My portfolio", "Compliance"],
  [/^\/subscriptions/, "Marketplace", "Subscription offerings"],
  [/^\/offerings\//, "Marketplace", "Subscription offering"],
  [/^\/issuer\/create/, "Issuer dashboard", "Create fund"],
  [/^\/issuer\/[^/]+\/registry/, "Issuer dashboard", "Investor registry"],
  [/^\/issuer\/[^/]+\/offering/, "Issuer dashboard", "Offering"],
  [/^\/issuer\/[^/]+\/controls/, "Issuer dashboard", "Token controls"],
  [/^\/issuer/, "Issuer dashboard", ""],
  [/^\/admin/, "Administration", "Issuer authorisations"],
];

export function WalletConnect() {
  const wallet = useWallet();
  const [selected, setSelected] = useState("");
  return (
    <div className="row">
      {wallet.options.length > 1 && (
        <div className="field__control">
          <select
            aria-label="Wallet provider"
            className="field__input"
            value={selected || wallet.options[0].id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {wallet.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        className="btn btn--primary"
        disabled={wallet.busy}
        onClick={() => void wallet.connect(selected)}
      >
        {wallet.busy ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}

export function TopBar({
  menuOpen,
  onMenu,
}: {
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const wallet = useWallet();
  const role = useRoleBadge();
  const { pathname } = useLocation();
  const section = sections.find(([pattern]) => pattern.test(pathname));
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={onMenu}
        >
          <Menu aria-hidden />
        </button>
        {section && (
          <p className="topbar__title">
            {section[1]}
            {section[2] && (
              <>
                {" / "}
                <strong>{section[2]}</strong>
              </>
            )}
          </p>
        )}
      </div>
      <div className="topbar__right">
        <SingaporeClock />
        <span
          className={`network${wallet.wrongNetwork ? " network--wrong" : wallet.account ? "" : " network--idle"}`}
          title={`Chain ID ${wallet.wrongNetwork ? wallet.chainId : targetNetwork.chainId}`}
        >
          <span className="hide-sm">
            {wallet.wrongNetwork
              ? `Wrong network (chain ${wallet.chainId})`
              : targetNetwork.name}
          </span>
        </span>
        {wallet.account ? (
          <>
            {role && (
              <span
                title={role.scope ? `Your role in ${role.scope}` : undefined}
              >
                <Pill tone={role.tone} plain>
                  {role.label}
                  {role.scope && (
                    <span className="hide-sm"> · {role.scope}</span>
                  )}
                </Pill>
              </span>
            )}
            <span className="account">
              <span className="visually-hidden">Connected wallet </span>
              <Address value={wallet.account} />
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={wallet.disconnect}
              aria-label="Disconnect wallet"
            >
              <LogOut aria-hidden />
              <span className="hide-sm">Disconnect</span>
            </button>
          </>
        ) : (
          <WalletConnect />
        )}
      </div>
    </header>
  );
}
