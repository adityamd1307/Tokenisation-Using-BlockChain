import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData, useAssets } from "../context/DataContext";
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
import type { Asset } from "../types";
import { EmptyState, ErrorMessage, Field, Loading } from "./common";
import { units } from "../utils/formatting";

export function useOfferingClock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);
  return tick;
}
export function OfferingProgress({ offering: o }: { offering: Offering }) {
  const scale = o.demand > o.hardCap ? o.demand : o.hardCap;
  return (
    <div className="subscription-progress">
      <div className="progress-heading">
        <span>Subscription demand</span>
        <strong>{demandPercent(o.demand, o.hardCap)}% of hard cap</strong>
      </div>
      <div
        className="funding-track"
        role="img"
        aria-label={`Demand ${musd(o.demand)} mUSD; soft cap ${musd(o.softCap)} mUSD; hard cap ${musd(o.hardCap)} mUSD`}
      >
        <div
          className="funding-fill"
          style={{ width: `${demandPercent(o.demand, scale)}%` }}
        />
        <span
          className="funding-marker soft"
          style={{ left: `${demandPercent(o.softCap, scale)}%` }}
        />
        <span
          className="funding-marker hard"
          style={{ left: `${demandPercent(o.hardCap, scale)}%` }}
        />
      </div>
      <div className="funding-legend">
        <span>Soft cap · {musd(o.softCap)} mUSD</span>
        <span>Hard cap · {musd(o.hardCap)} mUSD</span>
      </div>
      <p className="footnote">
        Demand is escrowed subscriptions, not earned proceeds. Rounding
        determines the final accepted amount.
      </p>
    </div>
  );
}
export function OfferingCard({
  offering: o,
  asset,
}: {
  offering: Offering;
  asset?: Asset;
}) {
  return (
    <article className="panel subscription-card">
      <div className="section-heading">
        <span className="eyebrow">Subscription offering · mUSD</span>
        <span className={`offering-status state-${o.state}`}>
          {offeringStatuses[o.state]}
        </span>
      </div>
      <h3>
        <Link to={`/offerings/${o.address}`}>
          {asset?.name || `Asset #${o.assetId}`}
        </Link>
      </h3>
      <p>
        {units(o.supply)} {asset?.symbol || "units"} offered at {musd(o.price)}{" "}
        mUSD each
      </p>
      <OfferingProgress offering={o} />
      <div className="card-bottom">
        <small>
          {o.state === 0 ? "Opens" : "Closes"}{" "}
          {new Date(
            Number(o.state === 0 ? o.start : o.end) * 1000,
          ).toLocaleString()}
        </small>
        <Link className="text-link" to={`/offerings/${o.address}`}>
          View offering ↗
        </Link>
      </div>
    </article>
  );
}
export function SubscriptionOfferings({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (!subscriptions.enabled)
    return compact ? null : (
      <EmptyState title="Subscription engine not deployed">
        Direct ETH sales remain available. Configure the local subscription
        deployment to enable mUSD offerings.
      </EmptyState>
    );
  return <EnabledSubscriptionOfferings compact={compact} />;
}
function EnabledSubscriptionOfferings({ compact }: { compact: boolean }) {
  const { revision } = useData(),
    assets = useAssets(),
    tick = useOfferingClock();
  const [page, setPage] = useState(0);
  const size = compact ? 4 : 12;
  const state = useAsync(
    `subscriptions:${revision}:${tick}:${page}`,
    () => subscriptions.list(page * size, size),
    subscriptions.enabled,
    true,
  );
  return (
    <section className="subscription-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Institutional primary issuance</p>
          <h2>Subscription offerings</h2>
          <p>
            Commit during the window. Settle your allocation after finalisation.
          </p>
        </div>
        {compact && (
          <Link className="text-link" to="/subscriptions">
            View all ↗
          </Link>
        )}
      </div>
      {state.error ? (
        <ErrorMessage message={state.error} retry={state.reload} />
      ) : state.loading && !state.data ? (
        <Loading />
      ) : !state.data?.items.length ? (
        <EmptyState title="No subscription offerings yet">
          Issuers can configure an offering for an existing asset in their
          dashboard.
        </EmptyState>
      ) : (
        <div className="subscription-grid">
          {state.data.items.map((o) => (
            <OfferingCard
              key={o.address}
              offering={o}
              asset={assets.data?.find((a) => a.id === o.assetId)}
            />
          ))}
        </div>
      )}
      {!compact && (
        <div className="action-row">
          <button
            className="button secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous offerings
          </button>
          <button
            className="button secondary"
            disabled={!state.data?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next offerings
          </button>
        </div>
      )}
    </section>
  );
}

function futureDate(minutes: number) {
  const d = new Date(Date.now() + minutes * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function SubscriptionCreation({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction();
  const [input, setInput] = useState<OfferingInput>(() => ({
    supply: "1000",
    price: "2",
    softCap: "1200",
    start: futureDate(5),
    end: futureDate(10),
  }));
  const [created, setCreated] = useState("");
  let issue = "",
    hardCap = "—";
  try {
    const [supply, price] = offeringArgs(
      input,
      BigInt(Math.floor(Date.now() / 1000)),
    );
    if (supply > asset.totalSupply)
      throw new Error("Supply exceeds this asset's fixed supply.");
    hardCap = musd(supply * price);
  } catch (e) {
    issue = (e as Error).message;
  }
  if (!subscriptions.enabled) return null;
  return (
    <section className="panel subscription-create">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Advanced primary issuance</p>
          <h2>Create a subscription offering</h2>
        </div>
        <span className="subtle-tag">Mock USD · 6 decimals</span>
      </div>
      <p>
        Offer existing {asset.symbol} inventory at a fixed mUSD price. The
        direct ETH sale remains available with its own inventory.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
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
        <div className="subscription-form-grid">
          {(
            [
              ["supply", "Tokens offered", "text"],
              ["price", "Price per token (mUSD)", "text"],
              ["softCap", "Soft cap (mUSD)", "text"],
              ["start", "Subscription start (local time)", "datetime-local"],
              ["end", "Subscription end (local time)", "datetime-local"],
            ] as const
          ).map(([key, label, type]) => (
            <Field key={key} label={label}>
              <input
                type={type}
                value={input[key]}
                onChange={(e) => setInput({ ...input, [key]: e.target.value })}
                required
              />
            </Field>
          ))}
        </div>
        <div className="notice info">
          Hard cap: <strong>{hardCap} mUSD</strong> · supply × price. Success
          requires a conservative guarantee after rounding; gross demand alone
          cannot guarantee success.
        </div>
        {issue && <p className="validation-message">{issue}</p>}
        <button
          className="button"
          disabled={
            !!issue ||
            tx.pending ||
            !wallet.roles?.issuer ||
            wallet.wrongNetwork
          }
        >
          Create subscription offering
        </button>
        {created && (
          <Link className="text-link" to={`/offerings/${created}`}>
            Manage and fund offering ↗
          </Link>
        )}
      </form>
      <p className="footnote">
        Approve the offering as an eligible holder and deposit its full
        inventory before the start time. Parameters cannot be edited after
        creation.
      </p>
    </section>
  );
}
