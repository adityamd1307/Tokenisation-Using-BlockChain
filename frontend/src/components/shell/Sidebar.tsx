import { NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  Briefcase,
  FilePlus,
  KeyRound,
  Landmark,
  List,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { targetNetwork } from "../../config/networks";
import { blockchain } from "../../services/blockchain";
import { useSelectedFund } from "../../context/FundContext";
import { useWorkspace } from "../../hooks/useRole";
import { Address } from "../ui/display";

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
function Group({ label, items }: { label: string; items: Item[] }) {
  return (
    <div className="nav-group" role="group" aria-label={label}>
      <span className="nav-group__label">{label}</span>
      {items.map(({ to, label: text, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-link">
          <Icon aria-hidden />
          {text}
        </NavLink>
      ))}
    </div>
  );
}

/** Workspaces: Marketplace, My portfolio, Issuer dashboard, Administration. */
export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const { fund } = useSelectedFund();
  const workspace = useWorkspace();
  const fundPath = (suffix = "") => (fund ? `/funds/${fund.id}${suffix}` : "/");
  const managedId =
    workspace.managed.find((a) => a.assetId === fund?.id)?.assetId ??
    workspace.managed[0]?.assetId;
  const issuerPath = (page: string) =>
    managedId !== undefined ? `/issuer/${managedId}/${page}` : "/issuer";
  return (
    <aside
      id="sidebar"
      className={`sidebar${open ? " is-open" : ""}`}
      aria-label="Workspaces"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) onNavigate();
      }}
    >
      <NavLink to="/" className="sidebar__brand" end>
        <span className="brand-mark" aria-hidden>
          AT
        </span>
        <span className="brand-name">
          AssetToken
          <small>Tokenised fund platform</small>
        </span>
      </NavLink>
      <nav className="nav" aria-label="Main navigation">
        <Group
          label="Marketplace"
          items={[
            { to: "/", label: "Fund registry", icon: Store, end: true },
            {
              to: fundPath(),
              label: "Fund overview",
              icon: Landmark,
              end: true,
            },
            { to: fundPath("/subscribe"), label: "Subscribe", icon: Wallet },
          ]}
        />
        <Group
          label="My portfolio"
          items={[
            { to: "/portfolio", label: "Holdings", icon: Briefcase },
            {
              to: fundPath("/transfer"),
              label: "Transfer",
              icon: ArrowLeftRight,
            },
            { to: "/activity", label: "Activity", icon: ScrollText },
          ]}
        />
        {workspace.issuer && (
          <Group
            label="Issuer dashboard"
            items={[
              ...(managedId !== undefined
                ? [
                    {
                      to: issuerPath("registry"),
                      label: "Investor registry",
                      icon: Users,
                    },
                    {
                      to: issuerPath("offering"),
                      label: "Offering",
                      icon: List,
                    },
                    {
                      to: issuerPath("controls"),
                      label: "Token controls",
                      icon: SlidersHorizontal,
                    },
                  ]
                : []),
              { to: "/issuer/create", label: "Create fund", icon: FilePlus },
            ]}
          />
        )}
        {workspace.admin && (
          <Group
            label="Administration"
            items={[
              { to: "/admin", label: "Issuer authorisations", icon: KeyRound },
            ]}
          />
        )}
      </nav>
      <div className="sidebar__footer">
        <h2>Network</h2>
        <dl className="meta">
          <dt>Chain</dt>
          <dd>
            {targetNetwork.name} · {targetNetwork.chainId}
          </dd>
          <dt>Factory</dt>
          <dd>
            {blockchain.config.AssetFactory ? (
              <Address value={blockchain.config.AssetFactory} />
            ) : (
              "Not deployed"
            )}
          </dd>
          <dt>Explorer</dt>
          <dd>{targetNetwork.explorer ? "Etherscan" : "None (local node)"}</dd>
        </dl>
        {fund && (
          <>
            <h2>
              <ShieldCheck size={12} aria-hidden /> {fund.symbol} contracts
            </h2>
            <dl className="meta">
              <dt>Token</dt>
              <dd>
                <Address value={fund.token} />
              </dd>
              <dt>Sale</dt>
              <dd>
                <Address value={fund.sale} />
              </dd>
            </dl>
          </>
        )}
      </div>
    </aside>
  );
}
