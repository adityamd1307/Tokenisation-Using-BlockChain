import { NavLink, Outlet } from "react-router-dom";
import { WalletControls, WalletNotices, WalletSummary } from "./WalletControls";
import { TransactionStatus } from "./TransactionStatus";
import { targetNetwork } from "../config/networks";
export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            a<span>t</span>
          </span>
          <div>
            AssetToken<small>ASSET MANAGEMENT</small>
          </div>
        </NavLink>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <span aria-hidden>▦</span>Marketplace
          </NavLink>
          <NavLink to="/issuer">
            <span aria-hidden>▤</span>Issuer dashboard
          </NavLink>
          <NavLink to="/portfolio">
            <span aria-hidden>◈</span>My portfolio
          </NavLink>
          <NavLink to="/admin">
            <span aria-hidden>⚙</span>Administration
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <WalletSummary />
          <div className="environment">
            <span className="dot" />
            LOCAL DEVELOPMENT<span>PHASE 04</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Tokenisation platform</strong>
          </div>
          <div className="topbar-actions">
            <span className="network-label">
              <span className="dot" />
              {targetNetwork.name}
            </span>
            <WalletControls />
          </div>
        </header>
        <main>
          <WalletNotices />
          <TransactionStatus />
          <Outlet />
        </main>
        <footer>
          <span>
            AssetToken <span className="footer-divider">/</span> SC4053
            Blockchain Technology
          </span>
          <p>
            Academic demonstration only. Assets and token prices are simulated.
            Tokens do not represent legally enforceable ownership or investment
            claims.
          </p>
        </footer>
      </div>
    </div>
  );
}
