import { useState, type ReactNode } from "react";
import type { Activity } from "../types";
import { formatTime } from "../utils/formatting";
import { Address, Eth, Units } from "./ui/display";
import { DataTable, type Column } from "./ui/table";
import { ErrorNotice } from "./ui/layout";

const columns: Column<Activity>[] = [
  {
    key: "time",
    header: "Time",
    render: (row) => (
      <span className="cell-title">
        <span className="nowrap">
          {row.timestamp ? formatTime(row.timestamp) : "Time unavailable"}
        </span>
        <span className="muted small">
          Block {row.block.toLocaleString("en-US")}
        </span>
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span className="cell-title">
        <span>{row.type}</span>
        {row.detail && <span className="muted small">{row.detail}</span>}
      </span>
    ),
  },
  { key: "fund", header: "Fund", render: (row) => row.asset },
  {
    key: "from",
    header: "From",
    render: (row) => (row.from ? <Address value={row.from} /> : "—"),
  },
  {
    key: "to",
    header: "To",
    render: (row) => (row.to ? <Address value={row.to} /> : "—"),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (row) =>
      row.quantity === undefined && row.paid === undefined ? (
        "—"
      ) : (
        <span className="cell-title">
          {row.quantity !== undefined && (
            <Units value={row.quantity} symbol={row.asset} />
          )}
          {row.paid !== undefined && (
            <span className={row.quantity !== undefined ? "muted" : undefined}>
              <Eth value={row.paid} />
            </span>
          )}
        </span>
      ),
  },
  {
    key: "tx",
    header: "Transaction",
    render: (row) => <Address value={row.hash} kind="tx" />,
  },
];

/** On-chain events as a table, newest first, 25 rows at a time. */
export function ActivityTable({
  rows,
  loading,
  error,
  retry,
  empty,
  caption,
  limit,
}: {
  rows: Activity[] | undefined;
  loading: boolean;
  error?: string;
  retry?: () => void;
  empty: ReactNode;
  caption: string;
  /** Show at most this many rows and no paging (e.g. a "recent" panel). */
  limit?: number;
}) {
  const [visible, setVisible] = useState(25);
  const shown = rows?.slice(0, limit ?? visible);
  if (error && !rows)
    return (
      <div className="panel__body">
        <ErrorNotice message={error} retry={retry} />
      </div>
    );
  return (
    <>
      <DataTable
        columns={columns}
        rows={shown}
        rowKey={(row) => row.id}
        caption={caption}
        loading={loading}
        empty={empty}
        sticky
      />
      {!limit && rows && rows.length > 0 && (
        <div className="table-footer">
          <span>
            Showing {Math.min(visible, rows.length).toLocaleString("en-US")} of{" "}
            {rows.length.toLocaleString("en-US")} events
          </span>
          {visible < rows.length && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setVisible((n) => n + 25)}
            >
              Show 25 more
            </button>
          )}
        </div>
      )}
    </>
  );
}
