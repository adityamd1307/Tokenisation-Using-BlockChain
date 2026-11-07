import { useState } from "react";
import { Link } from "react-router-dom";
import { useAssets } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { blockchain } from "../services/blockchain";
import { PAUSED } from "../utils/errors";
import { payment, quantity } from "../utils/validation";
import { units } from "../utils/formatting";
import { useAccountState } from "../hooks/data";
import { useFundRoute } from "../hooks/useFundRoute";
import type { Asset } from "../types";
import { Address, Eth, Facts, Units } from "../components/ui/display";
import {
  ActionButton,
  AmountField,
  blocker,
  Checklist,
  Summary,
  type Check,
} from "../components/ui/forms";
import { ErrorNotice, PageHeader, Panel } from "../components/ui/layout";
import { FundGate, FundStatus } from "../components/FundState";
import { FundSwitcher } from "../components/FundSwitcher";
import { ConnectPrompt } from "../components/shell/ConnectPrompt";

function parse(value: string) {
  if (!value.trim()) return { amount: undefined, error: undefined };
  try {
    return { amount: quantity(value), error: undefined };
  } catch {
    return {
      amount: undefined,
      error:
        "Enter a whole number of units greater than zero. This fund has no decimal places.",
    };
  }
}

/** AssetSale.buyTokens(quantity) with msg.value = quantity × pricePerToken. */
function SubscriptionForm({ fund }: { fund: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction();
  const state = useAccountState(fund);
  const [value, setValue] = useState("");
  const { amount, error } = parse(value);
  const cost = amount !== undefined ? payment(amount, fund.price) : undefined;
  const balance = wallet.ethBalance;
  const data = state.data;
  const affordable = balance !== null ? balance / fund.price : undefined;
  const max =
    affordable !== undefined
      ? affordable < fund.inventory
        ? affordable
        : fund.inventory
      : fund.inventory;
  const checks: Check[] = [
    {
      label: "Your wallet is a verified investor in this fund",
      ok: data?.eligible,
      reason:
        "Your wallet is not a verified investor in this fund. Ask the issuer to verify it.",
    },
    {
      label: "The sale contract is verified to deliver units",
      ok: data?.saleEligible,
      reason:
        "The sale contract is not verified yet. The issuer must verify it.",
    },
    {
      label: "The offering is open",
      ok: !fund.closed,
      reason: "This offering is permanently closed.",
    },
    { label: "Transfers are not paused", ok: !fund.paused, reason: PAUSED },
    {
      label: "Enough units are available",
      ok: amount === undefined ? true : amount <= fund.inventory,
      reason: `Only ${units(fund.inventory)} ${fund.symbol} are available.`,
      detail: <Units value={fund.inventory} symbol={fund.symbol} />,
    },
    {
      label: "Your ETH balance covers the payment",
      ok:
        balance === null
          ? undefined
          : cost === undefined
            ? true
            : balance >= cost,
      reason: "Your ETH balance does not cover this payment.",
      detail: balance !== null ? <Eth value={balance} /> : undefined,
    },
  ];
  const reason = tx.pending
    ? "Another transaction is in progress."
    : (blocker(checks) ??
      (error
        ? "Fix the amount first."
        : amount === undefined
          ? "Enter the number of units to subscribe for."
          : undefined));
  if (!wallet.account || wallet.wrongNetwork)
    return <ConnectPrompt purpose="subscribe to this fund" />;
  if (state.error && !data)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason) return;
        void tx
          .run("Subscription", () =>
            blockchain.buy(wallet.provider!, wallet.account!, fund, value),
          )
          .then((receipt) => receipt && setValue(""));
      }}
    >
      <AmountField
        label="Units to subscribe"
        symbol={fund.symbol}
        value={value}
        onChange={setValue}
        error={error}
        hint={`Up to ${units(max)} ${fund.symbol}: the smaller of the units available and what your ETH balance covers.`}
        onMax={max > 0n ? () => setValue(max.toString()) : undefined}
      />
      {amount !== undefined && cost !== undefined && (
        <Summary
          sentence={
            <>
              You will pay <Eth value={cost} /> and receive{" "}
              <Units value={amount} symbol={fund.symbol} />.
            </>
          }
          rows={[
            { label: "Price per unit", value: <Eth value={fund.price} /> },
            {
              label: "Units",
              value: <Units value={amount} symbol={fund.symbol} />,
            },
            { label: "Payment", value: <Eth value={cost} /> },
            {
              label: "Network fee",
              value: "Shown by your wallet before signing",
            },
          ]}
        />
      )}
      <Checklist label="Pre-flight checks" checks={checks} />
      <ActionButton type="submit" reason={reason}>
        Subscribe
      </ActionButton>
    </form>
  );
}

export default function Subscribe() {
  const route = useFundRoute();
  const wallet = useWallet();
  const all = useAssets().data ?? [];
  const fund = route.fund;
  if (!fund)
    return (
      <FundGate
        title="Subscribe"
        loading={route.loading}
        error={route.error}
        retry={route.reload}
      />
    );
  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <Link to={`/funds/${fund.id}`}>
            {fund.name} ({fund.symbol})
          </Link>
        }
        title="Subscribe"
        status={<FundStatus fund={fund} />}
        description="Pay ETH and receive units in the same transaction. Only verified investors can subscribe."
        actions={<FundSwitcher funds={all} current={fund} />}
      />
      <div className="layout-split">
        <Panel title="Subscription order">
          <SubscriptionForm key={`${wallet.session}:${fund.id}`} fund={fund} />
        </Panel>
        <Panel title="Offering terms" flush>
          <Facts
            label="Offering terms"
            items={[
              { label: "Price per unit", value: <Eth value={fund.price} /> },
              {
                label: "Available",
                value: <Units value={fund.inventory} symbol={fund.symbol} />,
              },
              {
                label: "Settlement",
                value:
                  "Atomic. Payment and delivery happen in one transaction.",
              },
              {
                label: "Payment to",
                value: <Address value={fund.sale} />,
              },
              {
                label: "Your ETH",
                value:
                  wallet.ethBalance !== null ? (
                    <Eth value={wallet.ethBalance} />
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
