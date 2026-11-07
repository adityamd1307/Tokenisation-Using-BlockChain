import type { ReactNode } from "react";
import { Skeleton } from "./display";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Hide the label in stacked (mobile) mode, e.g. for an actions column. */
  hideLabel?: boolean;
}

/**
 * Every list of records in the portal. Numbers right-aligned; skeleton rows that
 * match the final columns while loading; one sentence and the next action when
 * empty. Below 640px rows stack into label/value pairs; wider tables scroll with
 * a sticky first column.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  empty,
  skeletonRows = 4,
  sticky = false,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  empty: ReactNode;
  skeletonRows?: number;
  sticky?: boolean;
}) {
  const cell = (column: Column<T>) =>
    column.align === "right" ? "num" : undefined;
  return (
    <div className="table-wrap">
      <table
        className={`data-table data-table--stack${sticky ? " data-table--sticky" : ""}`}
        aria-busy={loading && !rows ? true : undefined}
      >
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cell(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows ? (
            loading ? (
              Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  {columns.map((column, position) => (
                    <td
                      key={column.key}
                      className={cell(column)}
                      data-label={column.hideLabel ? "" : column.header}
                    >
                      <Skeleton short={position > 0} />
                    </td>
                  ))}
                </tr>
              ))
            ) : null
          ) : rows.length === 0 ? (
            <tr>
              <td className="data-table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cell(column)}
                    data-label={column.hideLabel ? "" : column.header}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
