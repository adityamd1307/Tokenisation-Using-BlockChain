import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAssets, useData } from "../context/DataContext";
import { targetNetwork } from "../config/networks";
import { categoryName } from "../utils/formatting";
import type { Asset } from "../types";
import { Eth, Figures, Units } from "../components/ui/display";
import { DataTable, type Column } from "../components/ui/table";
import { SelectField, TextField } from "../components/ui/forms";
import {
  EmptyState,
  ErrorNotice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { FundStatus } from "../components/FundState";

const columns: Column<Asset>[] = [
  {
    key: "fund",
    header: "Fund",
    render: (fund) => (
      <span className="cell-title">
        <Link to={`/funds/${fund.id}`}>{fund.name}</Link>
        <span className="muted small">
          {fund.symbol} · Fund #{fund.id}
        </span>
      </span>
    ),
  },
  { key: "type", header: "Type", render: (f) => categoryName(f.category) },
  {
    key: "price",
    header: "Price per unit",
    align: "right",
    render: (f) => <Eth value={f.price} />,
  },
  {
    key: "available",
    header: "Available",
    align: "right",
    render: (f) => <Units value={f.inventory} symbol={f.symbol} />,
  },
  {
    key: "supply",
    header: "Total supply",
    align: "right",
    render: (f) => <Units value={f.totalSupply} symbol={f.symbol} />,
  },
  { key: "status", header: "Status", render: (f) => <FundStatus fund={f} /> },
];

/** Marketplace: every fund in the AssetFactory registry. */
export default function FundRegistry() {
  const assets = useAssets(),
    { refresh } = useData();
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all");
  const all = assets.data;
  const rows = all?.filter(
    (fund) =>
      `${fund.name} ${fund.symbol}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (type === "all" || fund.category === Number(type)) &&
      (status === "all" ||
        (status === "open" && !fund.closed) ||
        (status === "closed" && fund.closed) ||
        (status === "paused" && fund.paused)),
  );
  const filtered = query !== "" || type !== "all" || status !== "all";
  return (
    <div className="page">
      <PageHeader
        title="Fund registry"
        description="Funds issued through the platform factory. Prices are fixed at issuance and settled in ETH; every figure is read from the contracts."
        actions={
          <button className="btn btn--secondary" onClick={refresh}>
            <RefreshCw aria-hidden />
            Refresh
          </button>
        }
      />
      <Figures
        label="Registry summary"
        items={[
          {
            label: "Funds registered",
            value: all ? all.length.toLocaleString("en-US") : "—",
          },
          {
            label: "Open offerings",
            value: all
              ? all.filter((f) => !f.closed).length.toLocaleString("en-US")
              : "—",
          },
          {
            label: "Transfers paused",
            value: all
              ? all.filter((f) => f.paused).length.toLocaleString("en-US")
              : "—",
          },
          {
            label: "Network",
            value: targetNetwork.name,
            note: `Chain ID ${targetNetwork.chainId}`,
          },
        ]}
      />
      {assets.error ? (
        <ErrorNotice message={assets.error} retry={assets.reload} />
      ) : (
        <Panel title="Funds" flush>
          <div className="toolbar">
            <TextField
              className="field--grow"
              label="Search funds"
              value={query}
              onChange={setQuery}
              placeholder="Name or symbol"
            />
            <SelectField
              label="Asset type"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "All types" },
                { value: "0", label: "Real-world asset" },
                { value: "1", label: "Digital asset" },
              ]}
            />
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All statuses" },
                { value: "open", label: "Offering open" },
                { value: "closed", label: "Offering closed" },
                { value: "paused", label: "Transfers paused" },
              ]}
            />
          </div>
          <DataTable
            caption="Registered funds"
            columns={columns}
            rows={rows}
            rowKey={(fund) => fund.id}
            loading={assets.loading}
            sticky
            empty={
              all?.length ? (
                <EmptyState
                  action={
                    filtered && (
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          setQuery("");
                          setType("all");
                          setStatus("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )
                  }
                >
                  No funds match these filters.
                </EmptyState>
              ) : (
                <EmptyState>
                  No funds are registered yet. An authorised issuer can create
                  one from the issuer dashboard.
                </EmptyState>
              )
            }
          />
        </Panel>
      )}
    </div>
  );
}
