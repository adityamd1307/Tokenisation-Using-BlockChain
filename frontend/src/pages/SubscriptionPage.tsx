import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { subscriptions, type Offering } from "../services/subscriptions";
import {
  OfferingProgress,
  useOfferingClock,
} from "../components/SubscriptionOfferings";
import {
  Address,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
} from "../components/common";
import { ActivityTable } from "../components/TransactionHistory";
import { musd, offeringStatuses, parseUSD } from "../utils/subscription";
import { quantity } from "../utils/validation";
import { units } from "../utils/formatting";
import type { Activity, Asset } from "../types";

export default function SubscriptionPage() {
  const { address = "" } = useParams(),
    { revision, refresh } = useData(),
    tick = useOfferingClock();
  const read = useAsync(
    `offering:${address}:${revision}:${tick}`,
    async () => {
      const offering = await subscriptions.get(address);
      return { offering, asset: await blockchain.asset(offering.assetId) };
    },
    subscriptions.enabled,
    true,
  );
  if (!subscriptions.enabled)
    return <EmptyState title="Subscription engine not deployed" />;
  if (read.error)
    return <ErrorMessage message={read.error} retry={read.reload} />;
  if (
    !read.data ||
    read.data.offering.address.toLowerCase() !== address.toLowerCase()
  )
    return <Loading />;
  const { offering: o, asset } = read.data;
  return (
    <>
      <PageHeader
        eyebrow="Institutional primary issuance"
        title={asset.name}
        action={
          <button className="button secondary" onClick={refresh}>
            Refresh offering
          </button>
        }
      >
        Subscription offering · {asset.symbol} ·{" "}
        <Link to={`/assets/${asset.id}`}>View asset and direct ETH sale</Link>
      </PageHeader>
      <div className="notice info">
        Simulated assets and mUSD only. Mock USD has no monetary backing.
        Subscription demand is not an investment return.
      </div>
      <section className="panel offering-hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fixed price · proportional allocation</p>
            <h2>
              {musd(o.price)} <small>mUSD / {asset.symbol}</small>
            </h2>
          </div>
          <span className={`offering-status state-${o.state}`}>
            {offeringStatuses[o.state]}
          </span>
        </div>
        <OfferingProgress offering={o} />
        <dl className="subscription-stats">
          <div>
            <dt>Offered inventory</dt>
            <dd>
              {units(o.supply)} {asset.symbol}
            </dd>
          </div>
          <div>
            <dt>Total demand</dt>
            <dd>{musd(o.demand)} mUSD</dd>
          </div>
          <div>
            <dt>Subscribers / settled</dt>
            <dd>
              {o.subscribers.toString()} / {o.settledCount.toString()}
            </dd>
          </div>
          <div>
            <dt>Recognised accepted funding</dt>
            <dd>{musd(o.recognized)} mUSD</dd>
          </div>
        </dl>
        <div className="offering-dates">
          <span>
            Opens{" "}
            <strong>{new Date(Number(o.start) * 1000).toLocaleString()}</strong>
          </span>
          <span>
            Closes{" "}
            <strong>{new Date(Number(o.end) * 1000).toLocaleString()}</strong>
          </span>
          <span>
            {o.state === 0
              ? `Starts in ${((o.start - o.chainTime) / 60n).toString()} chain minutes`
              : o.state === 1
                ? `${((o.end - o.chainTime) / 60n).toString()} chain minutes remaining`
                : "Window closed"}
          </span>
        </div>
        {o.state === 3 && (
          <p className="notice success">
            Successful. Guaranteed accepted funding: {musd(o.guaranteed)} mUSD.
            Exact recognised proceeds increase as investors settle.
          </p>
        )}
        {o.state === 4 && (
          <p className="notice error">
            Failed. No tokens are allocated. Every subscriber can settle and
            withdraw their full commitment.
          </p>
        )}
        <p className="footnote">
          When oversubscribed, each allocation is rounded down. The success
          guarantee is max(0, offered units − subscribers + 1) × price. This
          conservative rule can fail an offering whose exact allocations would
          meet the soft cap.
        </p>
      </section>
      <OfferingWorkspace key={o.address} offering={o} asset={asset} />
      <OfferingHistory
        key={`${o.address}:${revision}`}
        offering={o}
        asset={asset}
      />
      <div className="panel contract-grid">
        <div>
          <small>Offering</small>
          <Address value={o.address} full />
        </div>
        <div>
          <small>Mock USD</small>
          <Address value={o.paymentToken} full />
        </div>
        <div>
          <small>Issuer</small>
          <Address value={o.issuer} full />
        </div>
      </div>
    </>
  );
}

export function OfferingWorkspace({
  offering: o,
  asset,
}: {
  offering: Offering;
  asset: Asset;
}) {
  const wallet = useWallet();
  return (
    <WalletWorkspace
      key={`${wallet.session}:${o.address}`}
      offering={o}
      asset={asset}
    />
  );
}
function WalletWorkspace({
  offering: o,
  asset,
}: {
  offering: Offering;
  asset: Asset;
}) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [amount, setAmount] = useState(""),
    [deposit, setDeposit] = useState("");
  const current = useAsync(
    `subscription-account:${wallet.session}:${o.address}:${revision}:${o.chainTime}`,
    () => subscriptions.account(o, asset, wallet.account!),
    !!wallet.account && !wallet.wrongNetwork,
  );
  if (!wallet.account)
    return (
      <EmptyState title="Connect your wallet to subscribe">
        Browse the offering freely; connect to commit, settle, claim or
        withdraw.
      </EmptyState>
    );
  if (wallet.wrongNetwork)
    return <EmptyState title="Switch to the configured network" />;
  if (current.error)
    return <ErrorMessage message={current.error} retry={current.reload} />;
  if (!current.data)
    return <Loading>Reading subscription and wallet balances…</Loading>;
  const a = current.data,
    issuer = wallet.account.toLowerCase() === o.issuer.toLowerCase();
  const run = (
    label: string,
    op: Parameters<typeof subscriptions.action>[3],
    value?: string,
  ) =>
    void tx.run(label, () =>
      subscriptions.action(
        wallet.provider!,
        wallet.account!,
        o.address,
        op,
        value,
      ),
    );
  let parsed = 0n,
    problem = "";
  try {
    parsed = parseUSD(amount);
    if (parsed % o.price !== 0n)
      problem = "Amount must be an exact multiple of the token price.";
    else if (parsed > a.balance) problem = "Insufficient mUSD balance.";
  } catch (e) {
    problem = (e as Error).message;
  }
  let inventory = 0n,
    depositProblem = "";
  try {
    inventory = quantity(deposit);
    if (inventory > o.supply - o.deposited)
      depositProblem = "Deposit exceeds remaining inventory.";
    else if (inventory > a.assetBalance)
      depositProblem = "Insufficient asset tokens in issuer wallet.";
  } catch (e) {
    depositProblem = (e as Error).message;
  }
  return (
    <div className="offering-workspace">
      {o.state === 2 && (
        <section className="panel">
          <h2>Ready to finalise</h2>
          <p>
            The subscription window has ended. Anyone can finalise; the contract
            determines success after rounding.
          </p>
          <button
            className="button"
            disabled={tx.pending}
            onClick={() => run("Finalise offering", "finalizeOffering")}
          >
            Finalise offering
          </button>
        </section>
      )}
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Investor workspace</p>
            <h2>Your subscription</h2>
          </div>
          <span className="subtle-tag">
            {a.eligible
              ? "Eligible investor"
              : "Eligibility required for tokens"}
          </span>
        </div>
        <dl className="subscription-stats">
          <div>
            <dt>Available mUSD</dt>
            <dd>{musd(a.balance)}</dd>
          </div>
          <div>
            <dt>Committed mUSD</dt>
            <dd>{musd(a.commitment)}</dd>
          </div>
          <div>
            <dt>Final allocation</dt>
            <dd>
              {o.finalized
                ? `${units(a.allocation)} ${asset.symbol}`
                : "After finalisation"}
            </dd>
          </div>
          <div>
            <dt>Accepted payment</dt>
            <dd>
              {o.finalized ? `${musd(a.accepted)} mUSD` : "After finalisation"}
            </dd>
          </div>
        </dl>
        {o.state === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run("Commit mUSD", "commit", amount);
            }}
          >
            <Field label="Commitment amount (mUSD)">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1800"
              />
            </Field>
            <p>
              Allowance: {musd(a.allowance)} mUSD. Approval and commitment are
              separate transactions.
            </p>
            {problem && amount && (
              <p className="validation-message">{problem}</p>
            )}
            {!a.eligible && (
              <p className="notice info">
                Ask the issuer to approve this wallet before subscribing.
              </p>
            )}
            {o.deposited !== o.supply && (
              <p className="notice info">
                The offering is not fully funded. Subscriptions are unavailable.
              </p>
            )}
            <div className="action-row">
              <button
                type="button"
                className="button secondary"
                disabled={
                  tx.pending ||
                  !!problem ||
                  !a.eligible ||
                  o.deposited !== o.supply ||
                  a.allowance >= parsed
                }
                onClick={() => run("Approve mUSD", "approveUSD", amount)}
              >
                Approve mUSD
              </button>
              <button
                className="button"
                disabled={
                  tx.pending ||
                  !!problem ||
                  !a.eligible ||
                  o.deposited !== o.supply ||
                  a.allowance < parsed
                }
              >
                Commit stablecoins
              </button>
            </div>
          </form>
        )}
        {o.state === 0 && (
          <p className="notice info">
            Subscriptions open at the scheduled start time.
          </p>
        )}
        {o.finalized && (
          <div className="allocation-card">
            <div>
              <span>
                {a.settled
                  ? "Refund available"
                  : "Refund entitlement after settlement"}
              </span>
              <strong>
                {musd(a.refund)} <small>mUSD</small>
              </strong>
            </div>
            <div>
              <span>Token claim</span>
              <strong>
                {a.claimed
                  ? "Claimed"
                  : a.allocation > 0n
                    ? "Unclaimed"
                    : "No allocation"}
              </strong>
            </div>
            <div className="action-row">
              <button
                className="button"
                disabled={tx.pending || a.settled || a.commitment === 0n}
                onClick={() => run("Settle subscription", "settleSubscription")}
              >
                {a.settled ? "Subscription settled" : "Settle subscription"}
              </button>
              <button
                className="button secondary"
                disabled={tx.pending || !a.settled || a.refund === 0n}
                onClick={() => run("Withdraw mUSD refund", "withdrawRefund")}
              >
                Withdraw refund
              </button>
              <button
                className="button secondary"
                disabled={
                  tx.pending ||
                  !a.settled ||
                  a.claimed ||
                  a.allocation === 0n ||
                  !a.eligible ||
                  !a.offeringEligible ||
                  a.paused
                }
                onClick={() => run("Claim allocated tokens", "claimTokens")}
              >
                Claim allocated tokens
              </button>
            </div>
            {(!a.eligible || !a.offeringEligible || a.paused) &&
              a.allocation > 0n && (
                <p className="notice info">
                  Token delivery requires an unpaused asset and eligible
                  investor and offering addresses. Refunds remain available
                  independently.
                </p>
              )}
          </div>
        )}
      </section>
      {issuer && (
        <section className="panel">
          <p className="eyebrow">Issuer controls</p>
          <h2>Manage offering</h2>
          <dl className="subscription-stats">
            <div>
              <dt>Inventory deposited</dt>
              <dd>
                {units(o.deposited)} / {units(o.supply)}
              </dd>
            </div>
            <div>
              <dt>Earned proceeds available</dt>
              <dd>{musd(o.recognized - o.withdrawn)} mUSD</dd>
            </div>
            <div>
              <dt>Recoverable inventory</dt>
              <dd>
                {units(o.recoverable)} {asset.symbol}
              </dd>
            </div>
          </dl>
          {o.state === 0 && (
            <>
              <Field label="Offering inventory deposit">
                <input
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  inputMode="numeric"
                  placeholder={(o.supply - o.deposited).toString()}
                />
              </Field>
              {depositProblem && deposit && (
                <p className="validation-message">{depositProblem}</p>
              )}
              <div className="action-row">
                <button
                  className="button secondary"
                  disabled={tx.pending || a.offeringEligible}
                  onClick={() =>
                    run("Approve offering eligibility", "whitelistOffering")
                  }
                >
                  Approve offering eligibility
                </button>
                <button
                  className="button secondary"
                  disabled={
                    tx.pending ||
                    !!depositProblem ||
                    a.assetAllowance >= inventory
                  }
                  onClick={() =>
                    run(
                      "Approve offering inventory",
                      "approveInventory",
                      deposit,
                    )
                  }
                >
                  Approve token spending
                </button>
                <button
                  className="button"
                  disabled={
                    tx.pending ||
                    !!depositProblem ||
                    !a.offeringEligible ||
                    a.paused ||
                    a.assetAllowance < inventory
                  }
                  onClick={() =>
                    run("Deposit offering inventory", "deposit", deposit)
                  }
                >
                  Deposit inventory
                </button>
              </div>
            </>
          )}
          <div className="action-row">
            <button
              className="button"
              disabled={tx.pending || o.recognized === o.withdrawn}
              onClick={() =>
                run("Withdraw subscription proceeds", "withdrawProceeds")
              }
            >
              Withdraw earned proceeds
            </button>
            <button
              className="button secondary"
              disabled={
                tx.pending ||
                o.recoverable === 0n ||
                !a.eligible ||
                !a.offeringEligible ||
                a.paused
              }
              onClick={() =>
                run("Recover unallocated inventory", "recoverUnsoldTokens")
              }
            >
              Recover unallocated tokens
            </button>
          </div>
          <p className="footnote">
            Unsettled deposits and refunds cannot be withdrawn as proceeds.
            Token reserves protect every unclaimed allocation.
          </p>
        </section>
      )}
    </div>
  );
}

function OfferingHistory({
  offering,
  asset,
}: {
  offering: Offering;
  asset: Asset;
}) {
  const [older, setOlder] = useState<Activity[]>([]),
    [cursor, setCursor] = useState<number | undefined | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const state = useAsync(`offering-history:${offering.address}`, () =>
    subscriptions.history(offering, asset),
  );
  const next = cursor === null ? state.data?.next : cursor;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Verified contract events</p>
          <h2>Subscription activity</h2>
        </div>
      </div>
      {state.error ? (
        <ErrorMessage message={state.error} retry={state.reload} />
      ) : !state.data ? (
        <Loading />
      ) : (
        <>
          <ActivityTable rows={[...state.data.rows, ...older]} />
          {next !== undefined && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const data = await subscriptions.history(
                    offering,
                    asset,
                    next,
                  );
                  setOlder((r) => [...r, ...data.rows]);
                  setCursor(data.next);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Load older blocks
            </button>
          )}
        </>
      )}
      {error && <ErrorMessage message={error} />}
      <p className="footnote">
        Queries cover 2,000 blocks at a time. Currency approvals are not
        investments; refunds and claims have separate event labels.
      </p>
    </section>
  );
}
