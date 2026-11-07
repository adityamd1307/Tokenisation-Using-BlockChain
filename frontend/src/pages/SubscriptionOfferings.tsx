import { futureSingaporeInput } from "../utils/time";
// mUSD subscription offerings (main, PRs #3 and #4) in the new design. The list
// and the create form read only when the subscription deployment is configured
// (main's AUD-016: optional features mount no reads when absent).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAssets, useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { subscriptions, type Offering } from "../services/subscriptions";
import {
  demandPercent,
  musd,
  offeringArgs,
  offeringStatuses,
  type OfferingInput,
} from "../utils/subscription";
import { formatTime, units } from "../utils/formatting";
import { targetNetwork } from "../config/networks";
import type { Asset } from "../types";
import { Meter, Musd, Pill, Units, type Tone } from "../components/ui/display";
import { DataTable, type Column } from "../components/ui/table";
import { ActionButton, Summary, TextField } from "../components/ui/forms";
import {
  EmptyState,
  ErrorNotice,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui/layout";

const stateTone: Tone[] = ["neutral", "ok", "warn", "ok", "err"];
export function OfferingStatus({ offering }: { offering: Offering }) {
  return (
    <Pill tone={stateTone[offering.state] ?? "neutral"}>
      {offeringStatuses[offering.state]}
    </Pill>
  );
}

/** Re-reads offering state as chain time moves the window. */
export function useOfferingClock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

export function Demand({ offering: o }: { offering: Offering }) {
  const scale = o.demand > o.hardCap ? o.demand : o.hardCap;
  const pct = (value: bigint) => Number(demandPercent(value, scale));
  return (
    <div className="stack stack--tight">
      <div className="row row--between small">
        <span className="muted">Subscription demand</span>
        <strong>{demandPercent(o.demand, o.hardCap)}% of hard cap</strong>
      </div>
      <Meter
        label={`Demand ${musd(o.demand)} mUSD; soft cap ${musd(o.softCap)} mUSD; hard cap ${musd(o.hardCap)} mUSD`}
        percent={pct(o.demand)}
        marks={[
          { at: pct(o.softCap), label: "Soft cap" },
          { at: pct(o.hardCap), label: "Hard cap" },
        ]}
      />
      <div className="row row--between muted small">
        <span>Soft cap {musd(o.softCap)} mUSD</span>
        <span>Hard cap {musd(o.hardCap)} mUSD</span>
      </div>
    </div>
  );
}

function List() {
  const { revision } = useData(),
    assets = useAssets(),
    tick = useOfferingClock();
  const [page, setPage] = useState(0);
  const size = 12;
  const state = useAsync(
    `subscriptions:${revision}:${tick}:${page}`,
    () => subscriptions.list(page * size, size),
    true,
    true,
  );
  const fund = (o: Offering) => assets.data?.find((a) => a.id === o.assetId);
  const columns: Column<Offering>[] = [
    {
      key: "fund",
      header: "Fund",
      render: (o) => (
        <span className="cell-title">
          <Link to={`/offerings/${o.address}`}>
            {fund(o)?.name ?? `Fund #${o.assetId}`}
          </Link>
          <span className="muted small">{fund(o)?.symbol}</span>
        </span>
      ),
    },
    {
      key: "price",
      header: "Price per unit",
      align: "right",
      render: (o) => <Musd value={o.price} />,
    },
    {
      key: "supply",
      header: "Offered",
      align: "right",
      render: (o) => (
        <Units value={o.supply} symbol={fund(o)?.symbol ?? "units"} />
      ),
    },
    {
      key: "demand",
      header: "Demand",
      align: "right",
      render: (o) => `${demandPercent(o.demand, o.hardCap)}% of hard cap`,
    },
    {
      key: "window",
      header: "Window",
      render: (o) =>
        `${o.state === 0 ? "Opens" : "Closes"} ${formatTime(Number(o.state === 0 ? o.start : o.end))}`,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <OfferingStatus offering={o} />,
    },
  ];
  return (
    <Panel title="Offerings" flush>
      {state.error && !state.data ? (
        <div className="panel__body">
          <ErrorNotice message={state.error} retry={state.reload} />
        </div>
      ) : (
        <>
          <DataTable
            caption="Subscription offerings"
            columns={columns}
            rows={state.data?.items}
            rowKey={(o) => o.address}
            loading={state.loading}
            sticky
            empty={
              <EmptyState>
                No subscription offerings yet. Issuers create them from the
                offering page of a fund they issued.
              </EmptyState>
            }
          />
          {(page > 0 || state.data?.hasMore) && (
            <div className="table-footer">
              <button
                className="btn btn--secondary btn--sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous offerings
              </button>
              <button
                className="btn btn--secondary btn--sm"
                disabled={!state.data?.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next offerings
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** Marketplace: every mUSD subscription offering. */
export default function SubscriptionOfferings() {
  return (
    <div className="page">
      <PageHeader
        title="Subscription offerings"
        description="Commit mUSD during the window; allocations are proportional and settled after finalisation. Simulated assets and Mock USD only."
      />
      {subscriptions.enabled ? (
        <List />
      ) : (
        <Panel title="Not deployed">
          <EmptyState>
            The subscription engine is not deployed on {targetNetwork.name}.
            Direct ETH subscriptions remain available.
          </EmptyState>
        </Panel>
      )}
    </div>
  );
}

/** Issuer: SubscriptionFactory.createOffering for one fund. */
export function CreateOffering({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction();
  const [input, setInput] = useState<OfferingInput>(() => ({
    supply: "1000",
    price: "2",
    softCap: "1200",
    start: futureSingaporeInput(5),
    end: futureSingaporeInput(10),
  }));
  const [created, setCreated] = useState("");
  let issue: string | undefined, hardCap: bigint | undefined;
  try {
    const [supply, price] = offeringArgs(
      input,
      BigInt(Math.floor(Date.now() / 1000)),
    );
    if (supply > asset.totalSupply)
      throw new Error("Supply exceeds this fund's fixed supply.");
    hardCap = supply * price;
  } catch (e) {
    issue = (e as Error).message;
  }
  const set = (key: keyof OfferingInput) => (value: string) =>
    setInput((v) => ({ ...v, [key]: value }));
  const dateField = (key: "start" | "end", label: string) => (
    <div className="field">
      <label className="field__label" htmlFor={`offering-${key}`}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={`offering-${key}`}
          className="field__input"
          type="datetime-local"
          value={input[key]}
          onChange={(e) => set(key)(e.target.value)}
        />
      </div>
    </div>
  );
  return (
    <Panel
      title="Create a subscription offering"
      description={`Offer ${asset.symbol} at a fixed mUSD price with proportional allocation. Parameters cannot be edited after creation.`}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (issue || tx.pending) return;
          setCreated("");
          const receipt = await tx.run("Create subscription offering", () =>
            subscriptions.create(
              wallet.provider!,
              wallet.account!,
              asset,
              input,
            ),
          );
          if (receipt)
            for (const log of receipt.logs) {
              try {
                if (
                  log.address.toLowerCase() !==
                  subscriptions.api.config.SubscriptionFactory?.toLowerCase()
                )
                  continue;
                const event = subscriptions.factory().interface.parseLog(log);
                if (event?.name === "OfferingCreated")
                  setCreated(event.args.offering);
              } catch {
                /* Other contract events. */
              }
            }
        }}
      >
        <div className="form-grid">
          <TextField
            label="Tokens offered"
            value={input.supply}
            onChange={set("supply")}
            mono
            inputMode="numeric"
            suffix={asset.symbol}
          />
          <TextField
            label="Price per token (mUSD)"
            value={input.price}
            onChange={set("price")}
            mono
            inputMode="decimal"
            suffix="mUSD"
          />
          <TextField
            label="Soft cap (mUSD)"
            value={input.softCap}
            onChange={set("softCap")}
            mono
            inputMode="decimal"
            suffix="mUSD"
          />
        </div>
        <div className="form-grid">
          {dateField("start", "Subscription start (Singapore, UTC+08:00)")}
          {dateField("end", "Subscription end (Singapore, UTC+08:00)")}
        </div>
        {hardCap !== undefined && (
          <Summary
            sentence={
              <>
                Hard cap <Musd value={hardCap} /> (supply × price). Success
                needs a conservative guarantee after rounding; demand alone
                cannot guarantee it.
              </>
            }
          />
        )}
        <ActionButton
          type="submit"
          reason={
            tx.pending
              ? "Another transaction is in progress."
              : wallet.wrongNetwork
                ? `Switch to ${targetNetwork.name} first.`
                : !wallet.roles?.issuer
                  ? "Only an authorised issuer can create offerings."
                  : issue
          }
        >
          Create subscription offering
        </ActionButton>
        {created && (
          <Notice tone="ok" title="Offering created">
            <Link to={`/offerings/${created}`}>
              Fund and manage the offering
            </Link>
            . Verify its escrow and deposit the full{" "}
            {units(BigInt(input.supply || "0"))} {asset.symbol} before the start
            time.
          </Notice>
        )}
      </form>
    </Panel>
  );
}
