import { useState, type ReactNode } from "react";
import { useWallet } from "../../context/WalletContext";
import { useTransaction } from "../../context/TransactionContext";
import { blockchain } from "../../services/blockchain";
import { PAUSED } from "../../utils/errors";
import { eth, units } from "../../utils/formatting";
import { quantity } from "../../utils/validation";
import { useAccountState } from "../../hooks/data";
import type { Asset } from "../../types";
import {
  Address,
  Eth,
  Facts,
  Figures,
  Units,
} from "../../components/ui/display";
import {
  ActionButton,
  AmountField,
  blocker,
  Checklist,
  type Check,
} from "../../components/ui/forms";
import {
  ConfirmDialog,
  ErrorNotice,
  Notice,
  Panel,
} from "../../components/ui/layout";
import { IssuerFrame } from "./IssuerFrame";

type Operation =
  "withdrawProceeds" | "closeSale" | "recoverUnsoldTokens" | "sweepExcessETH";
interface Confirm {
  title: string;
  label: string;
  body: ReactNode;
  danger?: boolean;
  run: () => void;
}

function OfferingConsole({ fund }: { fund: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction();
  const state = useAccountState(fund);
  const [value, setValue] = useState(""),
    [confirm, setConfirm] = useState<Confirm>();
  const data = state.data;
  let amount: bigint | undefined, amountError: string | undefined;
  if (value.trim())
    try {
      amount = quantity(value);
    } catch {
      amountError = "Enter a whole number of units greater than zero.";
    }
  if (amount !== undefined && data && amount > data.balance)
    amountError = `Your wallet holds only ${units(data.balance)} ${fund.symbol}.`;
  const busy = tx.pending ? "Another transaction is in progress." : undefined;
  const write = (
    label: string,
    send: () => ReturnType<typeof blockchain.approve>,
  ) => void tx.run(label, send);
  const manage = (operation: Operation, label: string) =>
    write(label, () =>
      blockchain.manageSale(wallet.provider!, wallet.account!, fund, operation),
    );
  const whitelist = (target: string) =>
    write("Verify address", () =>
      blockchain.whitelist(
        wallet.provider!,
        wallet.account!,
        fund,
        target,
        true,
      ),
    );

  if (state.error && !data)
    return <ErrorNotice message={state.error} retry={state.reload} />;

  // Phase 4 §7.5: sale contract and issuer verified, offering open; D5: not paused.
  const prerequisites: Check[] = [
    {
      label: "Sale contract is verified to hold units",
      ok: data?.saleEligible,
      reason: "Verify the sale contract first.",
      detail: data && !data.saleEligible && data.compliance && (
        <button
          className="btn btn--secondary btn--sm"
          disabled={!!busy}
          onClick={() => whitelist(fund.sale)}
        >
          Verify sale contract
        </button>
      ),
    },
    {
      label: "Your issuer wallet is verified",
      ok: data?.eligible,
      reason: "Your issuer wallet is not verified for this fund.",
      detail: data && !data.eligible && data.compliance && (
        <button
          className="btn btn--secondary btn--sm"
          disabled={!!busy}
          onClick={() => whitelist(wallet.account!)}
        >
          Restore issuer eligibility
        </button>
      ),
    },
    {
      label: "The offering is open",
      ok: !fund.closed,
      reason: "The offering is closed. No more units can be deposited.",
    },
    { label: "Transfers are not paused", ok: !fund.paused, reason: PAUSED },
  ];
  const prerequisite = blocker(prerequisites);
  const amountReason =
    amountError ??
    (amount === undefined ? "Enter the quantity to deposit." : undefined);
  const approved = amount !== undefined && !!data && data.allowance >= amount;
  const approveReason =
    busy ??
    prerequisite ??
    amountReason ??
    (approved ? "Already approved." : undefined);
  const depositReason =
    busy ??
    prerequisite ??
    amountReason ??
    (!approved && amount !== undefined
      ? `Approve ${units(amount)} ${fund.symbol} first.`
      : undefined);
  const excess =
    fund.saleEth > fund.proceeds ? fund.saleEth - fund.proceeds : 0n;
  const recoverChecks: Check[] = [
    {
      label: "The offering is closed",
      ok: fund.closed,
      reason: "Close the offering before recovering unsold units.",
    },
    {
      label: "Unsold units remain",
      ok: fund.inventory > 0n,
      reason: "There are no unsold units to recover.",
    },
    {
      label: "Sale contract and issuer are verified",
      ok: data ? data.saleEligible && data.eligible : undefined,
      reason:
        "Both the sale contract and the issuer must be verified for the units to move.",
    },
    { label: "Transfers are not paused", ok: !fund.paused, reason: PAUSED },
  ];

  return (
    <>
      <Figures
        label="Offering figures"
        items={[
          {
            label: "Issuer balance",
            value: data ? (
              <Units value={data.balance} symbol={fund.symbol} />
            ) : (
              "—"
            ),
          },
          {
            label: "Sale inventory",
            value: <Units value={fund.inventory} symbol={fund.symbol} />,
          },
          {
            label: "Approved for the sale",
            value: data ? (
              <Units value={data.allowance} symbol={fund.symbol} />
            ) : (
              "—"
            ),
            note: "Current ERC-20 allowance",
          },
          {
            label: "Unclaimed proceeds",
            value: <Eth value={fund.proceeds} />,
          },
        ]}
      />
      <div className="layout-halves">
        <Panel
          title="Fund the offering"
          description="Move units from your wallet into the sale contract so verified investors can subscribe."
          footer="Approval and deposit are separate transactions. The approval covers exactly this quantity; it does not move units."
        >
          <div className="form">
            <Checklist label="Deposit prerequisites" checks={prerequisites} />
            <AmountField
              label="Deposit quantity"
              symbol={fund.symbol}
              value={value}
              onChange={setValue}
              error={amountError}
              hint={
                data
                  ? `Your wallet holds ${units(data.balance)} ${fund.symbol}.`
                  : undefined
              }
              onMax={
                data && data.balance > 0n
                  ? () => setValue(data.balance.toString())
                  : undefined
              }
            />
            <ol className="steps" aria-label="Deposit steps">
              <li className={`step${approved ? " step--done" : ""}`}>
                <span className="step__index" aria-hidden>
                  1
                </span>
                <div>
                  <p className="step__title">Approve the sale contract</p>
                  <p className="step__detail">
                    Current allowance:{" "}
                    {data ? `${units(data.allowance)} ${fund.symbol}` : "…"}
                    {approved && " (enough for this deposit)"}
                  </p>
                </div>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  reason={approveReason}
                  onClick={() =>
                    write("Approve sale contract", () =>
                      blockchain.approve(
                        wallet.provider!,
                        wallet.account!,
                        fund,
                        value,
                      ),
                    )
                  }
                >
                  1. Approve
                </ActionButton>
              </li>
              <li className="step">
                <span className="step__index" aria-hidden>
                  2
                </span>
                <div>
                  <p className="step__title">Deposit into the offering</p>
                  <p className="step__detail">
                    Calls AssetSale.allocate and moves the units.
                  </p>
                </div>
                <ActionButton
                  size="sm"
                  reason={depositReason}
                  onClick={() =>
                    write("Inventory deposit", () =>
                      blockchain.deposit(
                        wallet.provider!,
                        wallet.account!,
                        fund,
                        value,
                      ),
                    )
                  }
                >
                  2. Deposit
                </ActionButton>
              </li>
            </ol>
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Sale proceeds" flush>
            <Facts
              label="Sale proceeds"
              items={[
                { label: "Price per unit", value: <Eth value={fund.price} /> },
                {
                  label: "Unclaimed proceeds",
                  value: <Eth value={fund.proceeds} />,
                },
                {
                  label: "Contract ETH balance",
                  value: <Eth value={fund.saleEth} />,
                },
                ...(excess > 0n
                  ? [
                      {
                        label: "Excess ETH",
                        value: (
                          <>
                            <Eth value={excess} />{" "}
                            <span className="muted small">
                              sent outside a purchase
                            </span>
                          </>
                        ),
                      },
                    ]
                  : []),
                {
                  label: "Paid to",
                  value: <Address value={fund.issuer} />,
                },
              ]}
            />
            <div className="panel__body stack stack--tight">
              <ActionButton
                reason={
                  busy ??
                  (fund.proceeds === 0n
                    ? "There are no proceeds to withdraw."
                    : undefined)
                }
                onClick={() =>
                  setConfirm({
                    title: "Withdraw sale proceeds?",
                    label: "Withdraw",
                    body: (
                      <p>
                        Withdraw {eth(fund.proceeds)} ETH to issuer{" "}
                        {fund.issuer}.
                      </p>
                    ),
                    run: () => manage("withdrawProceeds", "Withdraw proceeds"),
                  })
                }
              >
                Withdraw proceeds
              </ActionButton>
              {excess > 0n && (
                <ActionButton
                  variant="secondary"
                  reason={busy}
                  onClick={() =>
                    setConfirm({
                      title: "Recover excess ETH?",
                      label: "Recover",
                      body: (
                        <p>
                          Send {eth(excess)} ETH that arrived outside a purchase
                          to issuer {fund.issuer}. Unclaimed proceeds are not
                          affected.
                        </p>
                      ),
                      run: () => manage("sweepExcessETH", "Recover excess ETH"),
                    })
                  }
                >
                  Recover excess ETH
                </ActionButton>
              )}
            </div>
          </Panel>
          <Panel title="Offering status">
            <div className="stack">
              {fund.closed ? (
                <Notice title="Offering closed">
                  No further subscriptions or deposits are accepted. Unsold
                  units can be returned to the issuer.
                </Notice>
              ) : (
                <p className="secondary">
                  Closing the offering is permanent. Subscriptions and deposits
                  stop, and unsold units can then be returned to your wallet.
                </p>
              )}
              <ActionButton
                variant="danger"
                reason={busy ?? (fund.closed ? "Already closed." : undefined)}
                onClick={() =>
                  setConfirm({
                    title: "Permanently close the offering?",
                    label: "Close offering",
                    danger: true,
                    body: (
                      <p>
                        Closure cannot be undone. The sale contract {fund.sale}{" "}
                        will accept no further subscriptions or deposits.
                      </p>
                    ),
                    run: () => manage("closeSale", "Close offering"),
                  })
                }
              >
                Close offering
              </ActionButton>
              <Checklist
                label="Recovery prerequisites"
                checks={recoverChecks}
              />
              <ActionButton
                variant="secondary"
                reason={busy ?? blocker(recoverChecks)}
                onClick={() =>
                  setConfirm({
                    title: "Recover unsold units?",
                    label: "Recover",
                    body: (
                      <p>
                        Return all {units(fund.inventory)} {fund.symbol} to
                        issuer {fund.issuer}.
                      </p>
                    ),
                    run: () =>
                      manage("recoverUnsoldTokens", "Recover unsold units"),
                  })
                }
              >
                Recover unsold units
              </ActionButton>
            </div>
          </Panel>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onClose={() => setConfirm(undefined)}
          onConfirm={confirm.run}
        >
          {confirm.body}
        </ConfirmDialog>
      )}
    </>
  );
}

/** Issuer dashboard: AssetSale inventory, proceeds and lifecycle (Phase 4 §7.4–7.8). */
export default function Offering() {
  const wallet = useWallet();
  return (
    <IssuerFrame
      title="Offering"
      description="Fund the primary offering, withdraw proceeds, and close the sale. Only the fund's issuer can do this."
      allowed={(own) => own.saleIssuer}
      denied="Only this fund's issuer (AssetSale.issuer) can manage its offering."
    >
      {(fund) => (
        <OfferingConsole key={`${wallet.session}:${fund.id}`} fund={fund} />
      )}
    </IssuerFrame>
  );
}
