import { useState } from "react";
import { Link } from "react-router-dom";
import { useAssets } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { blockchain } from "../services/blockchain";
import { PAUSED } from "../utils/errors";
import { address, quantity } from "../utils/validation";
import { units } from "../utils/formatting";
import { useAccountState, useEligibility } from "../hooks/data";
import { useAsync } from "../hooks/useAsync";
import { useData } from "../context/DataContext";
import { useFundRoute } from "../hooks/useFundRoute";
import type { Asset } from "../types";
import {
  Address,
  Facts,
  Pill,
  Skeleton,
  Units,
} from "../components/ui/display";
import {
  ActionButton,
  AddressField,
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

function parseAddress(value: string) {
  if (!value.trim()) return { to: "", error: undefined };
  try {
    return { to: address(value), error: undefined };
  } catch (error) {
    return { to: "", error: (error as Error).message };
  }
}
function parseAmount(value: string) {
  if (!value.trim()) return { amount: undefined, error: undefined };
  try {
    return { amount: quantity(value), error: undefined };
  } catch {
    return {
      amount: undefined,
      error: "Enter a whole number of units greater than zero.",
    };
  }
}

/** AssetToken.transfer(to, amount): both ends must be whitelisted, token not paused. */
function TransferForm({ fund }: { fund: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction();
  const state = useAccountState(fund);
  const [recipient, setRecipient] = useState(""),
    [value, setValue] = useState("");
  const { to, error: addressError } = parseAddress(recipient);
  const { amount, error: amountError } = parseAmount(value);
  const eligibility = useEligibility(fund, to);
  const data = state.data;
  const recipientOk = to ? eligibility.data : undefined;
  // Regulated funds (main): the token's own transferStatus decides, with the reason.
  const { revision } = useData();
  const regulated = !!fund.identityRegistry;
  const policy = useAsync(
    `transfer-status:${fund.id}:${wallet.account}:${to}:${amount}:${revision}`,
    () => blockchain.preflight(fund, wallet.account!, to, amount!),
    regulated && !!wallet.account && !!to && amount !== undefined,
  );
  const checks: Check[] = regulated
    ? [
        {
          label: "Identity and fund policy allow this transfer",
          ok:
            !to || amount === undefined
              ? true
              : policy.loading
                ? undefined
                : !policy.error,
          reason: policy.error,
        },
      ]
    : [
        {
          label: "Your wallet is a verified investor in this fund",
          ok: data?.eligible,
          reason:
            "Your eligibility for this fund has been revoked. Contact the issuer before transferring.",
        },
        {
          label: "The recipient is a verified investor in this fund",
          ok: to ? recipientOk : true,
          reason: `Recipient is not a verified investor in ${fund.symbol}. The issuer must verify it first.`,
        },
      ];
  checks.push(
    { label: "Transfers are not paused", ok: !fund.paused, reason: PAUSED },
    {
      label: "Your balance covers the amount",
      ok: !data
        ? undefined
        : amount === undefined
          ? true
          : amount <= data.balance,
      reason: "Insufficient balance.",
      detail: data ? (
        <Units value={data.balance} symbol={fund.symbol} />
      ) : undefined,
    },
  );
  const reason = tx.pending
    ? "Another transaction is in progress."
    : addressError || amountError
      ? "Fix the highlighted fields first."
      : !to
        ? "Enter a recipient address."
        : amount === undefined
          ? "Enter the number of units to send."
          : blocker(checks);
  if (!wallet.account || wallet.wrongNetwork)
    return <ConnectPrompt purpose="transfer units" />;
  if (state.error && !data)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason) return;
        void tx
          .run("Transfer", () =>
            blockchain.transfer(
              wallet.provider!,
              wallet.account!,
              fund,
              to,
              value,
            ),
          )
          .then((receipt) => receipt && setValue(""));
      }}
    >
      <AddressField
        label="Recipient address"
        value={recipient}
        onChange={setRecipient}
        error={addressError}
        status={
          !to
            ? undefined
            : eligibility.loading
              ? { tone: "pending", text: "Checking recipient eligibility…" }
              : eligibility.error
                ? { tone: "err", text: eligibility.error }
                : eligibility.data
                  ? {
                      tone: "ok",
                      text: `Recipient is a verified investor in ${fund.symbol}.`,
                    }
                  : {
                      tone: "err",
                      text: `Recipient is not a verified investor in ${fund.symbol}. A transfer to it would be rejected.`,
                    }
        }
      />
      <AmountField
        label="Units to send"
        symbol={fund.symbol}
        value={value}
        onChange={setValue}
        error={amountError}
        hint={
          data ? `You hold ${units(data.balance)} ${fund.symbol}.` : undefined
        }
        onMax={
          data && data.balance > 0n
            ? () => setValue(data.balance.toString())
            : undefined
        }
      />
      {to && amount !== undefined && (
        <Summary
          sentence={
            <>
              You will send <Units value={amount} symbol={fund.symbol} /> to{" "}
              <Address value={to} />.
            </>
          }
        />
      )}
      <Checklist label="Pre-flight checks" checks={checks} />
      <ActionButton type="submit" reason={reason}>
        Transfer
      </ActionButton>
    </form>
  );
}

export default function Transfer() {
  const route = useFundRoute();
  const wallet = useWallet();
  const all = useAssets().data ?? [];
  const fund = route.fund;
  const state = useAccountState(fund);
  if (!fund)
    return (
      <FundGate
        title="Transfer"
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
        title="Transfer"
        status={<FundStatus fund={fund} />}
        description="Send units to another verified investor. The token contract rejects transfers to or from addresses that are not verified."
        actions={<FundSwitcher funds={all} current={fund} />}
      />
      <div className="layout-split">
        <Panel title="Transfer instruction">
          <TransferForm key={`${wallet.session}:${fund.id}`} fund={fund} />
        </Panel>
        <Panel title="Your position" flush>
          {wallet.account && !wallet.wrongNetwork ? (
            <Facts
              label="Your position"
              items={[
                {
                  label: "Units held",
                  value: state.data ? (
                    <Units value={state.data.balance} symbol={fund.symbol} />
                  ) : (
                    <Skeleton short />
                  ),
                },
                {
                  label: "Eligibility",
                  value: state.data ? (
                    <Pill tone={state.data.eligible ? "ok" : "err"}>
                      {state.data.eligible ? "Verified" : "Revoked"}
                    </Pill>
                  ) : (
                    <Skeleton short />
                  ),
                },
                {
                  label: "Token contract",
                  value: <Address value={fund.token} />,
                },
              ]}
            />
          ) : (
            <div className="panel__body muted">
              Connect a wallet to see your position.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
