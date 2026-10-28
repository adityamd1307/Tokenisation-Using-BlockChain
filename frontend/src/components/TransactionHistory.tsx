import type { Activity, Asset } from "../types";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { assetHistory } from "../services/history";
import { Address, EmptyState, ErrorMessage, Loading } from "./common";
import { eth, units } from "../utils/formatting";
export function ActivityTable({ rows }: { rows: Activity[] }) {
  const [visible, setVisible] = useState(20);
  if (!rows.length)
    return (
      <EmptyState title="No activity yet">
        Confirmed on-chain events will appear here.
      </EmptyState>
    );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Asset / amount</th>
              <th>From → To</th>
              <th>Transaction</th>
              <th>Block / time</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, visible).map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.type}</strong>
                </td>
                <td>
                  {row.quantity !== undefined
                    ? `${units(row.quantity)} ${row.asset}`
                    : row.asset}
                  {row.paid !== undefined && <small>{eth(row.paid)} ETH</small>}
                </td>
                <td>
                  {row.from && <Address value={row.from} />}
                  {row.to && (
                    <div>
                      → <Address value={row.to} />
                    </div>
                  )}
                </td>
                <td>
                  <Address value={row.hash} />
                </td>
                <td>
                  #{row.block}
                  <small>
                    {row.timestamp
                      ? new Date(row.timestamp * 1000).toLocaleString()
                      : "Timestamp unavailable"}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible < rows.length && (
        <button
          className="button secondary"
          onClick={() => setVisible((n) => n + 20)}
        >
          Show more activity
        </button>
      )}
    </>
  );
}
import { useState } from "react";
export function TransactionHistory({
  assets,
  account,
}: {
  assets: Asset[];
  account?: string;
}) {
  const { revision } = useData();
  const state = useAsync(
    `history:${assets.map((a) => a.id).join(",")}:${account || "all"}:${revision}`,
    async () =>
      (
        await Promise.all(
          assets.map((asset) => assetHistory(blockchain, asset, account)),
        )
      )
        .flat()
        .sort((a, b) => b.block - a.block || b.index - a.index),
  );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">On-chain record</p>
          <h2>Transaction activity</h2>
        </div>
        <button className="text-button" onClick={state.reload}>
          Refresh
        </button>
      </div>
      {state.loading ? (
        <Loading>Loading transaction activity…</Loading>
      ) : state.error ? (
        <ErrorMessage message={state.error} retry={state.reload} />
      ) : (
        <ActivityTable rows={state.data || []} />
      )}
      <p className="footnote">
        Events from the configured deployment onward. Purchases appear once;
        contract logs are not a legal ownership register.
      </p>
    </section>
  );
}
