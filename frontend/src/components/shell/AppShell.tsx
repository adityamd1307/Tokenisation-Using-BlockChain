import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useWallet } from "../../context/WalletContext";
import { useData } from "../../context/DataContext";
import { targetNetwork } from "../../config/networks";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TxStatus } from "./TxStatus";

/** Persistent wrong-network and wallet-error banners above every page. */
export function NetworkBanner() {
  const wallet = useWallet();
  return (
    <>
      {wallet.wrongNetwork && (
        <div className="banner banner--err" role="alert">
          <CircleAlert aria-hidden />
          <p className="banner__text">
            Your wallet is on chain {wallet.chainId}. This portal runs on{" "}
            {targetNetwork.name} (chain {targetNetwork.chainId}). Actions are
            disabled until you switch.
          </p>
          <button
            className="btn btn--secondary btn--sm"
            disabled={wallet.busy}
            onClick={() => void wallet.switchChain()}
          >
            Switch network
          </button>
        </div>
      )}
      {wallet.error && (
        <div className="banner banner--warn" role="alert">
          <TriangleAlert aria-hidden />
          <p className="banner__text">{wallet.error}</p>
          <button
            className="btn btn--secondary btn--sm"
            onClick={wallet.refresh}
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { refreshRegistry } = useData();
  useEffect(() => {
    setMenuOpen(false);
    refreshRegistry();
    // refreshRegistry is a fresh closure each render; run on navigation only
    // (location.key changes on every navigation, even to the same path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  useEffect(() => {
    const onFocus = () => refreshRegistry();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshRegistry]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <button
        type="button"
        className={`scrim${menuOpen ? " is-open" : ""}`}
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <div className="main">
        <TopBar menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} />
        <NetworkBanner />
        <main id="content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          Academic demonstration on a test network (SC4053). Units are simulated
          and carry no legal or beneficial claim. On-chain events are not a
          legal ownership register.
        </footer>
      </div>
      <TxStatus />
    </div>
  );
}
