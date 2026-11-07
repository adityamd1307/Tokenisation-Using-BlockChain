import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAssets, useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useConnected, useHistory, useHoldings } from "../hooks/data";
import type { Holding } from "../types";
import { Eth, Figures, Pill, Units } from "../components/ui/display";
import { DataTable, type Column } from "../components/ui/table";
import {
  EmptyState,
  ErrorNotice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { ActivityTable } from "../components/ActivityTable";
import { ConnectPrompt } from "../components/shell/ConnectPrompt";

const columns: Column<Holding>[] = [
  {
    key: "fund",
    header: "Fund",
    render: ({ asset }) => (
      <span className="cell-title">
        <Link to={`/funds/${asset.id}`}>{asset.name}</Link>
        <span className="muted small">{asset.symbol}</span>
      </span>
    ),
  },
  {
    key: "units",
    header: "Units held",
    align: "right",
    render: (h) => <Units value={h.balance} symbol={h.asset.symbol} />,
  },
  {
    key: "price",
    header: "Price per unit",
    align: "right",
    render: (h) => <Eth value={h.asset.price} />,
  },
  {
    key: "value",
    header: "Value at issue price",
    align: "right",
    render: (h) => <Eth value={h.balance * h.asset.price} />,
  },
  {
    key: "eligibility",
    header: "Eligibility",
    render: (h) => (
      <Pill tone={h.eligible ? "ok" : "err"}>
        {h.eligible ? "Verified" : "Revoked"}
      </Pill>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    hideLabel: true,
    render: (h) => (
      <span className="cell-actions">
        <Link
          className="btn btn--secondary btn--sm"
          to={`/funds/${h.asset.id}/transfer`}
          aria-label={`Transfer ${h.asset.symbol}`}
        >
          Transfer
        </Link>
      </span>
    ),
  },
];

/** My portfolio: positions across every fund and the wallet's own activity. */
export default function Portfolio() {
  const wallet = useWallet(),
    connected = useConnected(),
    assets = useAssets(),
    holdings = useHoldings(),
    { refresh } = useData();
  const history = useHistory(
    connected ? assets.data : undefined,
    wallet.account ?? undefined,
  );
  const held = holdings.data?.filter((h) => h.balance > 0n);
  const total = held?.reduce((sum, h) => sum + h.balance * h.asset.price, 0n);
  return (
    <div className="page">
      <PageHeader
        title="Holdings"
        description="Units held by the connected wallet in each fund, read directly from each token contract."
        actions={
          connected && (
            <button className="btn btn--secondary" onClick={refresh}>
              <RefreshCw aria-hidden />
              Refresh
            </button>
          )
        }
      />
      {!connected ? (
        <ConnectPrompt purpose="see your holdings" />
      ) : holdings.error || assets.error ? (
        <ErrorNotice
          message={(holdings.error || assets.error)!}
          retry={() => {
            assets.reload();
            holdings.reload();
          }}
        />
      ) : (
        <>
          <Figures
            label="Portfolio summary"
            items={[
              {
                label: "Funds held",
                value: held ? held.length.toLocaleString("en-US") : "—",
              },
              {
                label: "Value at issue price",
                value: total !== undefined ? <Eth value={total} /> : "—",
                note: "Units × fixed price. Not a market valuation.",
              },
              {
                label: "ETH balance",
                value:
                  wallet.ethBalance !== null ? (
                    <Eth value={wallet.ethBalance} />
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
          <Panel title="Positions" flush>
            <DataTable
              caption="Positions"
              columns={columns}
              rows={held}
              rowKey={(h) => h.asset.id}
              loading={holdings.loading}
              empty={
                <EmptyState
                  action={<Link to="/">Browse the fund registry</Link>}
                >
                  No holdings yet. Subscribe to a fund to receive units.
                </EmptyState>
              }
            />
          </Panel>
          <Panel title="Your activity" flush>
            <ActivityTable
              caption="Your activity"
              rows={history.data}
              loading={history.loading}
              error={history.error}
              retry={history.reload}
              empty={
                <EmptyState>
                  No subscriptions or transfers involve this wallet yet.
                </EmptyState>
              }
            />
          </Panel>
        </>
      )}
    </div>
  );
}
