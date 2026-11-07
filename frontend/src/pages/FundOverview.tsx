import { Link } from "react-router-dom";
import { useAssets } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { targetNetwork } from "../config/networks";
import { blockchain } from "../services/blockchain";
import { holderCount } from "../services/registry";
import { useAccountState, useHistory, useRegistry } from "../hooks/data";
import { useFundRoute } from "../hooks/useFundRoute";
import { categoryName } from "../utils/formatting";
import type { Asset } from "../types";
import {
  Address,
  Eth,
  Facts,
  Figures,
  Pill,
  Skeleton,
  Units,
} from "../components/ui/display";
import { PageHeader, Panel } from "../components/ui/layout";
import { EmptyState } from "../components/ui/layout";
import { FundGate, FundStatus } from "../components/FundState";
import { FundSwitcher } from "../components/FundSwitcher";
import { ActivityTable } from "../components/ActivityTable";
import { ConnectPrompt } from "../components/shell/ConnectPrompt";

function Position({ fund }: { fund: Asset }) {
  const wallet = useWallet();
  const state = useAccountState(fund);
  const prompt = <ConnectPrompt purpose="see your position in this fund" />;
  if (!wallet.account || wallet.wrongNetwork) return prompt;
  const data = state.data;
  return (
    <Facts
      label="Your position"
      items={[
        {
          label: "Units held",
          value: data ? (
            <Units value={data.balance} symbol={fund.symbol} />
          ) : (
            <Skeleton short />
          ),
        },
        {
          label: "Value at issue price",
          value: data ? (
            <Eth value={data.balance * fund.price} />
          ) : (
            <Skeleton short />
          ),
        },
        {
          label: "Eligibility",
          value: data ? (
            <Pill tone={data.eligible ? "ok" : "warn"}>
              {data.eligible ? "Verified investor" : "Not verified"}
            </Pill>
          ) : (
            <Skeleton short />
          ),
        },
      ]}
    />
  );
}

/** Fund factsheet: key facts, parties and contracts, position and recent activity. */
export default function FundOverview() {
  const route = useFundRoute();
  const all = useAssets().data ?? [];
  const fund = route.fund;
  const registry = useRegistry(fund);
  const history = useHistory(fund ? [fund] : undefined);
  if (!fund)
    return (
      <FundGate
        title="Fund overview"
        loading={route.loading}
        error={route.error}
        retry={route.reload}
      />
    );
  const rows = registry.data;
  const issuerBalance = rows?.find(
    (row) => row.address.toLowerCase() === fund.issuer.toLowerCase(),
  )?.balance;
  const distributed =
    issuerBalance !== undefined
      ? fund.totalSupply - fund.inventory - issuerBalance
      : undefined;
  const pending = <Skeleton short />;
  return (
    <div className="page">
      <PageHeader
        eyebrow={`${categoryName(fund.category)} · Fund #${fund.id}`}
        title={fund.name}
        status={<FundStatus fund={fund} />}
        description={fund.description || "The issuer gave no description."}
        actions={
          <>
            <FundSwitcher funds={all} current={fund} />
            <Link
              className="btn btn--secondary"
              to={`/funds/${fund.id}/transfer`}
            >
              Transfer
            </Link>
            <Link
              className="btn btn--primary"
              to={`/funds/${fund.id}/subscribe`}
            >
              Subscribe
            </Link>
          </>
        }
      />
      <Figures
        label="Key figures"
        items={[
          {
            label: "Price per unit",
            value: <Eth value={fund.price} />,
            note: "Fixed at issuance",
          },
          {
            label: "Total supply",
            value: <Units value={fund.totalSupply} symbol={fund.symbol} />,
          },
          {
            label: "Available to subscribe",
            value: <Units value={fund.inventory} symbol={fund.symbol} />,
          },
          {
            label: "Investors holding units",
            value: rows
              ? holderCount(rows, fund).toLocaleString("en-US")
              : pending,
            note: "From on-chain transfer events",
          },
        ]}
      />
      <div className="layout-split">
        <div className="stack">
          <Panel title="Fund facts" flush>
            <Facts
              label="Fund facts"
              items={[
                { label: "Fund name", value: fund.name },
                { label: "Symbol", value: fund.symbol },
                { label: "Asset type", value: categoryName(fund.category) },
                {
                  label: "Price per unit",
                  value: (
                    <>
                      <Eth value={fund.price} />{" "}
                      <span className="muted small">
                        fixed at issuance; cannot change
                      </span>
                    </>
                  ),
                },
                {
                  label: "Total supply",
                  value: (
                    <Units value={fund.totalSupply} symbol={fund.symbol} />
                  ),
                },
                {
                  label: "Held by investors",
                  value:
                    distributed !== undefined ? (
                      <Units value={distributed} symbol={fund.symbol} />
                    ) : (
                      pending
                    ),
                },
                {
                  label: "In the offering",
                  value: <Units value={fund.inventory} symbol={fund.symbol} />,
                },
                {
                  label: "Held by the issuer",
                  value:
                    issuerBalance !== undefined ? (
                      <Units value={issuerBalance} symbol={fund.symbol} />
                    ) : (
                      pending
                    ),
                },
                { label: "Unit precision", value: "Whole units (0 decimals)" },
                {
                  label: "Offering",
                  value: fund.closed
                    ? "Closed permanently. No new subscriptions."
                    : "Open to verified investors",
                },
                {
                  label: "Transfers",
                  value: fund.paused
                    ? "Paused by the issuer"
                    : "Active between verified investors",
                },
                {
                  label: "Settlement",
                  value:
                    "ETH paid and units delivered in one transaction (delivery versus payment)",
                },
              ]}
            />
          </Panel>
          <Panel title="Parties and contracts" flush>
            <Facts
              label="Parties and contracts"
              items={[
                {
                  label: "Issuer",
                  value: <Address value={fund.issuer} full />,
                },
                {
                  label: "Token contract",
                  value: <Address value={fund.token} full />,
                },
                {
                  label: "Sale contract",
                  value: <Address value={fund.sale} full />,
                },
                {
                  label: "Factory",
                  value: (
                    <Address value={blockchain.config.AssetFactory} full />
                  ),
                },
                {
                  label: "Network",
                  value: `${targetNetwork.name} (chain ${targetNetwork.chainId})`,
                },
              ]}
            />
          </Panel>
        </div>
        <Panel title="Your position">
          <Position fund={fund} />
        </Panel>
      </div>
      <Panel
        title="Recent activity"
        flush
        actions={
          <Link className="small" to={`/activity?fund=${fund.id}`}>
            View all activity
          </Link>
        }
      >
        <ActivityTable
          caption={`Recent ${fund.symbol} activity`}
          rows={history.data}
          loading={history.loading}
          error={history.error}
          retry={history.reload}
          limit={8}
          empty={
            <EmptyState>No on-chain activity for this fund yet.</EmptyState>
          }
        />
      </Panel>
    </div>
  );
}
