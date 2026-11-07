import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccess, useAssets } from "../../context/DataContext";
import { useWallet } from "../../context/WalletContext";
import { useFundRoute } from "../../hooks/useFundRoute";
import type { Asset, FundAccess } from "../../types";
import { Notice, PageHeader } from "../../components/ui/layout";
import { FundGate, FundStatus, PageSkeleton } from "../../components/FundState";
import { FundSwitcher } from "../../components/FundSwitcher";
import { ConnectPrompt } from "../../components/shell/ConnectPrompt";

/**
 * Shared frame for issuer-dashboard pages: the fund from the route, an on-chain
 * role check for the connected wallet, and a switcher over funds it manages.
 */
export function IssuerFrame({
  title,
  description,
  allowed,
  denied,
  actions,
  regulated,
  children,
}: {
  title: string;
  description: string;
  /** Whether this wallet's roles in the fund permit the page (spec-v1 §3, D5). */
  allowed: (own: FundAccess) => boolean;
  /** One sentence saying which role is needed. */
  denied: string;
  actions?: ReactNode;
  /** Shown instead of the page for regulated funds, which have no AccessControl roles. */
  regulated?: (fund: Asset) => ReactNode;
  children: (fund: Asset, own: FundAccess) => ReactNode;
}) {
  const wallet = useWallet();
  const route = useFundRoute();
  const access = useAccess();
  const all = useAssets().data ?? [];
  const fund = route.fund;
  if (!fund)
    return (
      <FundGate
        title={title}
        loading={route.loading}
        error={route.error}
        retry={route.reload}
      />
    );
  const managed = all.filter((asset) =>
    access.data?.some(
      (a) =>
        a.assetId === asset.id &&
        (a.saleIssuer || a.compliance || a.tokenAdmin),
    ),
  );
  const own = access.data?.find((a) => a.assetId === fund.id);
  const header = (
    <PageHeader
      eyebrow={
        <Link to={`/funds/${fund.id}`}>
          {fund.name} ({fund.symbol})
        </Link>
      }
      title={title}
      status={<FundStatus fund={fund} />}
      description={description}
      actions={
        <>
          <FundSwitcher
            funds={managed.some((m) => m.id === fund.id) ? managed : all}
            current={fund}
          />
          {own && allowed(own) && actions}
        </>
      }
    />
  );
  if (!wallet.account || wallet.wrongNetwork)
    return (
      <div className="page">
        {header}
        <ConnectPrompt purpose="use the issuer dashboard" />
      </div>
    );
  if (!own) {
    if (access.error)
      return (
        <div className="page">
          {header}
          <Notice tone="err" title="Could not read your roles">
            {access.error}
          </Notice>
        </div>
      );
    return <PageSkeleton title={title} />;
  }
  if (fund.identityRegistry && regulated)
    return (
      <div className="page">
        {header}
        {regulated(fund)}
      </div>
    );
  if (!allowed(own))
    return (
      <div className="page">
        {header}
        <Notice tone="warn" title="Role required">
          {denied}
        </Notice>
      </div>
    );
  return (
    <div className="page">
      {header}
      {children(fund, own)}
    </div>
  );
}
