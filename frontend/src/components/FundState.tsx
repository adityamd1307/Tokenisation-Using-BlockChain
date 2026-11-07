import { Link } from "react-router-dom";
import type { Asset } from "../types";
import { Pill, Skeleton } from "./ui/display";
import { EmptyState, ErrorNotice, PageHeader, Panel } from "./ui/layout";

/** Offering status (AssetSale.saleClosed) and transfer status (AssetToken.paused). */
export function FundStatus({ fund }: { fund: Asset }) {
  return (
    <span className="row">
      <Pill tone={fund.closed ? "neutral" : "ok"}>
        {fund.closed ? "Offering closed" : "Offering open"}
      </Pill>
      {fund.paused && <Pill tone="warn">Transfers paused</Pill>}
    </span>
  );
}

/** Layout-matched placeholder while the registry loads. */
export function PageSkeleton({ title }: { title: string }) {
  return (
    <div className="page" aria-busy="true">
      <PageHeader title={title} eyebrow={<Skeleton />} />
      <Panel title="Loading">
        <div className="stack">
          <Skeleton />
          <Skeleton />
          <Skeleton short />
        </div>
      </Panel>
    </div>
  );
}

/** Loading, error or not-found handling for a page that needs one fund. */
export function FundGate({
  title,
  loading,
  error,
  retry,
}: {
  title: string;
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="page">
        <PageHeader title={title} />
        <ErrorNotice message={error} retry={retry} />
      </div>
    );
  if (loading) return <PageSkeleton title={title} />;
  return (
    <div className="page">
      <PageHeader title={title} />
      <Panel title="Fund not found">
        <EmptyState action={<Link to="/">Go to the fund registry</Link>}>
          No fund with this ID exists in the registry.
        </EmptyState>
      </Panel>
    </div>
  );
}
