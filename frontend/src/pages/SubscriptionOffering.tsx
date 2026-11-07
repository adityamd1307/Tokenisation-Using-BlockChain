// One mUSD subscription offering (main's SubscriptionPage, PRs #3 and #4) in the new
// design. Every write goes through subscriptions.action unchanged.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { subscriptions, type Offering } from "../services/subscriptions";
import { musd, parseUSD } from "../utils/subscription";
import { quantity } from "../utils/validation";
import { formatTime, units } from "../utils/formatting";
import type { Activity, Asset } from "../types";
import { Address, Facts, Figures, Musd, Units } from "../components/ui/display";
import { ActionButton, AmountField, TextField } from "../components/ui/forms";
import {
  EmptyState,
  ErrorNotice,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { ActivityTable } from "../components/ActivityTable";
import { ConnectPrompt } from "../components/shell/ConnectPrompt";
import { PageSkeleton } from "../components/FundState";
import {
  Demand,
  OfferingStatus,
  useOfferingClock,
} from "./SubscriptionOfferings";

type Operation = Parameters<typeof subscriptions.action>[3];

function Workspace({
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
  // AUD-009-style scope: keep the last read while refreshing within this session.
  const scope = `subscription-account:${wallet.session}:${o.address}:`;
  const current = useAsync(
    `${scope}${revision}:${o.chainTime}`,
    () => subscriptions.account(o, asset, wallet.account!),
    !!wallet.account && !wallet.wrongNetwork,
    scope,
  );
  if (!wallet.account || wallet.wrongNetwork)
    return <ConnectPrompt purpose="commit, settle, claim or withdraw" />;
  if (current.error && !current.data)
    return <ErrorNotice message={current.error} retry={current.reload} />;
  if (!current.data) return <PageSkeleton title="Your subscription" />;
  const a = current.data,
    issuer = wallet.account.toLowerCase() === o.issuer.toLowerCase();
  const busy = tx.pending ? "Another transaction is in progress." : undefined;
  const run = (label: string, op: Operation, value?: string) =>
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
    problem: string | undefined;
  if (amount.trim())
    try {
      parsed = parseUSD(amount);
      if (parsed % o.price !== 0n)
        problem = `Enter an exact multiple of the price (${musd(o.price)} mUSD).`;
      else if (parsed > a.balance) problem = "Insufficient mUSD balance.";
    } catch (e) {
      problem = (e as Error).message;
    }
  const commitBlock =
    busy ??
    (!a.eligible
      ? "Your wallet is not approved for this fund. Ask the issuer."
      : o.deposited !== o.supply
        ? "The offering is not fully funded. Subscriptions are unavailable."
        : problem
          ? "Fix the amount first."
          : !amount.trim()
            ? "Enter a commitment amount."
            : undefined);
  const approved = parsed > 0n && a.allowance >= parsed;

  let inventory = 0n,
    depositProblem: string | undefined;
  if (deposit.trim())
    try {
      inventory = quantity(deposit);
      if (inventory > o.supply - o.deposited)
        depositProblem = "Deposit exceeds the remaining inventory.";
      else if (inventory > a.assetBalance)
        depositProblem = "Insufficient fund units in the issuer wallet.";
    } catch (e) {
      depositProblem = (e as Error).message;
    }
  const custody = asset.identityRegistry
    ? "Authorize subscription custody"
    : "Approve offering eligibility";
  const claimBlock =
    busy ??
    (!a.settled
      ? "Settle first."
      : a.claimed
        ? "Already claimed."
        : a.allocation === 0n
          ? "No allocation."
          : !a.eligible || !a.offeringEligible || a.paused
            ? "Delivery needs an unpaused fund and eligible investor and offering addresses. Refunds stay available."
            : undefined);
  return (
    <>
      {o.state === 2 && (
        <Panel title="Ready to finalise">
          <div className="stack">
            <p className="secondary">
              The subscription window has ended. Anyone can finalise; the
              contract determines success after rounding.
            </p>
            <ActionButton
              reason={busy}
              onClick={() => run("Finalise offering", "finalizeOffering")}
            >
              Finalise offering
            </ActionButton>
          </div>
        </Panel>
      )}
      <div className="layout-halves">
        <Panel
          title="Your subscription"
          description={
            a.eligible
              ? "Eligible investor"
              : "Eligibility is required to receive units"
          }
          flush
        >
          <Facts
            label="Your subscription"
            items={[
              { label: "Available mUSD", value: <Musd value={a.balance} /> },
              { label: "Committed", value: <Musd value={a.commitment} /> },
              {
                label: "Final allocation",
                value: o.finalized ? (
                  <Units value={a.allocation} symbol={asset.symbol} />
                ) : (
                  "After finalisation"
                ),
              },
              {
                label: "Accepted payment",
                value: o.finalized ? (
                  <Musd value={a.accepted} />
                ) : (
                  "After finalisation"
                ),
              },
            ]}
          />
          <div className="panel__body">
            {o.state === 1 && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commitBlock && approved)
                    run("Commit mUSD", "commit", amount);
                }}
              >
                <AmountField
                  label="Commitment amount (mUSD)"
                  symbol="mUSD"
                  value={amount}
                  onChange={setAmount}
                  error={amount ? problem : undefined}
                  hint={`Multiples of ${musd(o.price)} mUSD. Approval and commitment are separate transactions.`}
                />
                {o.deposited !== o.supply && (
                  <Notice tone="warn">
                    The offering is not fully funded. Subscriptions are
                    unavailable until the issuer deposits the full inventory.
                  </Notice>
                )}
                <ol className="steps" aria-label="Commitment steps">
                  <li className={`step${approved ? " step--done" : ""}`}>
                    <span className="step__index" aria-hidden>
                      1
                    </span>
                    <div>
                      <p className="step__title">
                        Approve mUSD for this offering
                      </p>
                      <p className="step__detail">
                        Current allowance: {musd(a.allowance)} mUSD
                      </p>
                    </div>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      reason={
                        commitBlock ??
                        (approved ? "Already approved." : undefined)
                      }
                      onClick={() => run("Approve mUSD", "approveUSD", amount)}
                    >
                      Approve mUSD
                    </ActionButton>
                  </li>
                  <li className="step">
                    <span className="step__index" aria-hidden>
                      2
                    </span>
                    <div>
                      <p className="step__title">Commit to the offering</p>
                      <p className="step__detail">
                        mUSD is held in escrow until settlement.
                      </p>
                    </div>
                    <ActionButton
                      type="submit"
                      size="sm"
                      reason={
                        commitBlock ??
                        (!approved ? "Approve mUSD first." : undefined)
                      }
                    >
                      Commit stablecoins
                    </ActionButton>
                  </li>
                </ol>
              </form>
            )}
            {o.state === 0 && (
              <Notice>Subscriptions open at the scheduled start time.</Notice>
            )}
            {o.finalized && (
              <div className="stack">
                <Facts
                  compact
                  label="Settlement"
                  items={[
                    {
                      label: a.settled
                        ? "Refund available"
                        : "Refund after settlement",
                      value: <Musd value={a.refund} />,
                    },
                    {
                      label: "Unit claim",
                      value: a.claimed
                        ? "Claimed"
                        : a.allocation > 0n
                          ? "Unclaimed"
                          : "No allocation",
                    },
                  ]}
                />
                <div className="row">
                  <ActionButton
                    reason={
                      busy ??
                      (a.settled
                        ? "Already settled."
                        : a.commitment === 0n
                          ? "Nothing committed."
                          : undefined)
                    }
                    onClick={() =>
                      run("Settle subscription", "settleSubscription")
                    }
                  >
                    {a.settled ? "Subscription settled" : "Settle subscription"}
                  </ActionButton>
                </div>
                <div className="row">
                  <ActionButton
                    variant="secondary"
                    reason={
                      busy ??
                      (!a.settled
                        ? "Settle first."
                        : a.refund === 0n
                          ? "No refund due."
                          : undefined)
                    }
                    onClick={() =>
                      run("Withdraw mUSD refund", "withdrawRefund")
                    }
                  >
                    Withdraw refund
                  </ActionButton>
                </div>
                <div className="row">
                  <ActionButton
                    variant="secondary"
                    reason={claimBlock}
                    onClick={() => run("Claim allocated tokens", "claimTokens")}
                  >
                    Claim allocated tokens
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        </Panel>
        {issuer && (
          <Panel
            title="Manage offering"
            description="Issuer controls. Unsettled deposits and refunds cannot be withdrawn as proceeds."
            flush
          >
            <Facts
              label="Offering inventory and proceeds"
              items={[
                {
                  label: "Inventory deposited",
                  value: `${units(o.deposited)} / ${units(o.supply)} ${asset.symbol}`,
                },
                {
                  label: "Earned proceeds available",
                  value: <Musd value={o.recognized - o.withdrawn} />,
                },
                {
                  label: "Recoverable inventory",
                  value: <Units value={o.recoverable} symbol={asset.symbol} />,
                },
              ]}
            />
            <div className="panel__body form">
              {o.state === 0 && (
                <>
                  <TextField
                    label="Offering inventory deposit"
                    value={deposit}
                    onChange={setDeposit}
                    mono
                    inputMode="numeric"
                    suffix={asset.symbol}
                    placeholder={(o.supply - o.deposited).toString()}
                    error={deposit ? depositProblem : undefined}
                  />
                  <ol className="steps" aria-label="Funding steps">
                    <li
                      className={`step${a.offeringEligible ? " step--done" : ""}`}
                    >
                      <span className="step__index" aria-hidden>
                        1
                      </span>
                      <div>
                        <p className="step__title">{custody}</p>
                        <p className="step__detail">
                          The offering escrow must be allowed to hold units.
                        </p>
                      </div>
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        reason={
                          busy ?? (a.offeringEligible ? "Done." : undefined)
                        }
                        onClick={() => run(custody, "whitelistOffering")}
                      >
                        {custody}
                      </ActionButton>
                    </li>
                    <li
                      className={`step${inventory > 0n && a.assetAllowance >= inventory ? " step--done" : ""}`}
                    >
                      <span className="step__index" aria-hidden>
                        2
                      </span>
                      <div>
                        <p className="step__title">Approve the units</p>
                        <p className="step__detail">
                          Current allowance: {units(a.assetAllowance)}{" "}
                          {asset.symbol}
                        </p>
                      </div>
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        reason={
                          busy ??
                          (!deposit.trim()
                            ? "Enter a quantity."
                            : depositProblem
                              ? "Fix the quantity first."
                              : a.assetAllowance >= inventory
                                ? "Already approved."
                                : undefined)
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
                      </ActionButton>
                    </li>
                    <li className="step">
                      <span className="step__index" aria-hidden>
                        3
                      </span>
                      <div>
                        <p className="step__title">Deposit into the offering</p>
                        <p className="step__detail">
                          The full supply must be deposited before the start.
                        </p>
                      </div>
                      <ActionButton
                        size="sm"
                        reason={
                          busy ??
                          (!deposit.trim()
                            ? "Enter a quantity."
                            : depositProblem
                              ? "Fix the quantity first."
                              : !a.offeringEligible
                                ? "Complete step 1 first."
                                : a.paused
                                  ? "The fund is paused."
                                  : a.assetAllowance < inventory
                                    ? "Complete step 2 first."
                                    : undefined)
                        }
                        onClick={() =>
                          run("Deposit offering inventory", "deposit", deposit)
                        }
                      >
                        Deposit inventory
                      </ActionButton>
                    </li>
                  </ol>
                </>
              )}
              <div className="row">
                <ActionButton
                  reason={
                    busy ??
                    (o.recognized === o.withdrawn
                      ? "No earned proceeds to withdraw."
                      : undefined)
                  }
                  onClick={() =>
                    run("Withdraw subscription proceeds", "withdrawProceeds")
                  }
                >
                  Withdraw earned proceeds
                </ActionButton>
              </div>
              <div className="row">
                <ActionButton
                  variant="secondary"
                  reason={
                    busy ??
                    (o.recoverable === 0n
                      ? "Nothing to recover."
                      : !a.eligible || !a.offeringEligible || a.paused
                        ? "Needs an unpaused fund and eligible issuer and offering addresses."
                        : undefined)
                  }
                  onClick={() =>
                    run("Recover unallocated inventory", "recoverUnsoldTokens")
                  }
                >
                  Recover unallocated tokens
                </ActionButton>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

function History({ offering, asset }: { offering: Offering; asset: Asset }) {
  const { revision } = useData();
  const [rows, setRows] = useState<Activity[]>([]),
    [next, setNext] = useState<number>(),
    [loadingMore, setLoadingMore] = useState(false),
    [error, setError] = useState("");
  const first = useAsync(
    `offering-history:${offering.address}:${revision}`,
    () => subscriptions.history(offering, asset),
  );
  const all = [...(first.data?.rows ?? []), ...rows];
  const cursor = rows.length ? next : first.data?.next;
  return (
    <Panel
      title="Subscription activity"
      flush
      actions={
        cursor !== undefined && (
          <button
            className="btn btn--ghost btn--sm"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              try {
                const data = await subscriptions.history(
                  offering,
                  asset,
                  cursor,
                );
                setRows((r) => [...r, ...data.rows]);
                setNext(data.next);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setLoadingMore(false);
              }
            }}
          >
            Load earlier blocks
          </button>
        )
      }
    >
      <ActivityTable
        caption="Subscription activity"
        rows={first.data ? all : undefined}
        loading={first.loading}
        error={first.error ?? (error || undefined)}
        retry={first.reload}
        empty={
          <EmptyState>No subscription activity in recent blocks.</EmptyState>
        }
      />
    </Panel>
  );
}

/** Marketplace: one subscription offering. */
export default function SubscriptionOffering() {
  const { address = "" } = useParams(),
    wallet = useWallet(),
    { revision, refresh } = useData(),
    tick = useOfferingClock();
  const state = useAsync(
    `offering:${address}:${revision}:${tick}`,
    async () => {
      const offering = await subscriptions.get(address);
      return { offering, asset: await blockchain.asset(offering.assetId) };
    },
    subscriptions.enabled,
    `offering:${address}:`,
  );
  if (!subscriptions.enabled)
    return (
      <div className="page">
        <PageHeader title="Subscription offering" />
        <Panel title="Not deployed">
          <EmptyState action={<Link to="/">Go to the fund registry</Link>}>
            The subscription engine is not deployed on this network.
          </EmptyState>
        </Panel>
      </div>
    );
  if (state.error && !state.data)
    return (
      <div className="page">
        <PageHeader title="Subscription offering" />
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>
    );
  if (!state.data) return <PageSkeleton title="Subscription offering" />;
  const { offering: o, asset } = state.data;
  const remaining =
    o.state === 0
      ? `Opens ${formatTime(Number(o.start))}`
      : o.state === 1
        ? `Closes ${formatTime(Number(o.end))}`
        : "Window closed";
  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <Link to={`/funds/${asset.id}`}>
            {asset.name} ({asset.symbol})
          </Link>
        }
        title="Subscription offering"
        status={<OfferingStatus offering={o} />}
        description="Fixed mUSD price, proportional allocation. Simulated assets and Mock USD only; mUSD has no monetary backing."
        actions={
          <button className="btn btn--secondary" onClick={refresh}>
            <RefreshCw aria-hidden />
            Refresh
          </button>
        }
      />
      <Figures
        label="Offering figures"
        items={[
          { label: "Price per unit", value: <Musd value={o.price} /> },
          {
            label: "Offered",
            value: <Units value={o.supply} symbol={asset.symbol} />,
          },
          {
            label: "Total demand",
            value: <Musd value={o.demand} />,
            note: `${o.subscribers} subscribers, ${o.settledCount} settled`,
          },
          {
            label: "Recognised funding",
            value: <Musd value={o.recognized} />,
            note: remaining,
          },
        ]}
      />
      <Panel
        title="Demand"
        footer="When oversubscribed, each allocation is rounded down. The success guarantee is max(0, offered units − subscribers + 1) × price, which can fail an offering whose exact allocations would meet the soft cap."
      >
        <div className="stack">
          <Demand offering={o} />
          {o.state === 3 && (
            <Notice tone="ok" title="Successful">
              Guaranteed accepted funding: {musd(o.guaranteed)} mUSD. Recognised
              proceeds increase as investors settle.
            </Notice>
          )}
          {o.state === 4 && (
            <Notice tone="err" title="Failed">
              Failed. No tokens are allocated. Every subscriber can settle and
              withdraw their full commitment.
            </Notice>
          )}
        </div>
      </Panel>
      <Workspace
        key={`${wallet.session}:${o.address}`}
        offering={o}
        asset={asset}
      />
      <History key={`${o.address}`} offering={o} asset={asset} />
      <Panel title="Contracts" flush>
        <Facts
          label="Offering contracts"
          items={[
            { label: "Offering", value: <Address value={o.address} full /> },
            {
              label: "Mock USD",
              value: <Address value={o.paymentToken} full />,
            },
            { label: "Issuer", value: <Address value={o.issuer} full /> },
            { label: "Subscription start", value: formatTime(Number(o.start)) },
            { label: "Subscription end", value: formatTime(Number(o.end)) },
          ]}
        />
      </Panel>
    </div>
  );
}
