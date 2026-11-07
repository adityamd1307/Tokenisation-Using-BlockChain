import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "../../context/WalletContext";
import { useTransaction } from "../../context/TransactionContext";
import { blockchain } from "../../services/blockchain";
import { address, quantity } from "../../utils/validation";
import { units } from "../../utils/formatting";
import { useEligibility, useRegistry } from "../../hooks/data";
import { useAsync } from "../../hooks/useAsync";
import { useData } from "../../context/DataContext";
import type { Asset, RegistryRow } from "../../types";
import { Address, Pill, Units } from "../../components/ui/display";
import { DataTable, type Column } from "../../components/ui/table";
import {
  ActionButton,
  AddressField,
  AmountField,
  blocker,
  Checklist,
  type Check,
} from "../../components/ui/forms";
import {
  ConfirmDialog,
  EmptyState,
  Notice,
  Panel,
} from "../../components/ui/layout";
import { IssuerFrame } from "./IssuerFrame";

const parseAddress = (value: string) => {
  if (!value.trim()) return { value: "", error: undefined };
  try {
    return { value: address(value), error: undefined };
  } catch (error) {
    return { value: "", error: (error as Error).message };
  }
};

interface Confirm {
  title: string;
  label: string;
  body: ReactNode;
  run: () => void;
}

function Controls({ fund }: { fund: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [params] = useSearchParams();
  const [fromInput, setFrom] = useState(params.get("from") ?? ""),
    [toInput, setTo] = useState(""),
    [value, setValue] = useState(""),
    [agentInput, setAgent] = useState(""),
    [confirm, setConfirm] = useState<Confirm>();
  const busy = tx.pending ? "Another transaction is in progress." : undefined;
  const from = parseAddress(fromInput),
    to = parseAddress(toInput),
    agent = parseAddress(agentInput);
  const fromEligible = useEligibility(fund, from.value);
  const toEligible = useEligibility(fund, to.value);
  const fromBalance = useAsync(
    `balance:${fund.id}:${from.value}:${revision}`,
    () => blockchain.balance(fund, from.value),
    !!from.value,
  );
  const registry = useRegistry(fund);
  let amount: bigint | undefined, amountError: string | undefined;
  if (value.trim())
    try {
      amount = quantity(value);
    } catch {
      amountError = "Enter a whole number of units greater than zero.";
    }

  // spec-v1 §5 D5 forcedTransfer preconditions.
  const checks: Check[] = [
    {
      label: "Source eligibility has been revoked",
      ok: from.value
        ? fromEligible.data === undefined
          ? undefined
          : !fromEligible.data
        : undefined,
      reason:
        "The source address is still verified. Revoke its eligibility in the investor registry first.",
    },
    {
      label: "Recipient is a verified investor",
      ok: to.value ? toEligible.data : undefined,
      reason: "The recipient is not a verified investor in this fund.",
    },
    {
      label: "Amount does not exceed the source balance",
      ok:
        fromBalance.data === undefined || amount === undefined
          ? undefined
          : amount <= fromBalance.data,
      reason: `The source holds only ${units(fromBalance.data ?? 0n)} ${fund.symbol}.`,
      detail:
        fromBalance.data !== undefined ? (
          <Units value={fromBalance.data} symbol={fund.symbol} />
        ) : undefined,
    },
  ];
  const forcedReason =
    busy ??
    (from.error || to.error || amountError
      ? "Fix the highlighted fields first."
      : !from.value
        ? "Enter the source address."
        : !to.value
          ? "Enter the recipient address."
          : amount === undefined
            ? "Enter the amount to move."
            : blocker(checks));

  const agents = registry.data?.filter((row) => row.compliance) ?? [];
  const agentColumns: Column<RegistryRow>[] = [
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <Address
          value={row.address}
          tag={
            row.address.toLowerCase() === wallet.account?.toLowerCase()
              ? "You"
              : row.address.toLowerCase() === fund.issuer.toLowerCase()
                ? "Issuer"
                : undefined
          }
        />
      ),
    },
    {
      key: "roles",
      header: "Roles",
      render: (row) => (
        <span className="row">
          <span className="tag">Compliance agent</span>
          {row.tokenAdmin && <span className="tag">Token admin</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      hideLabel: true,
      render: (row) => (
        <span className="cell-actions">
          <button
            className="btn btn--danger btn--sm"
            disabled={!!busy}
            aria-label={`Revoke compliance role from ${row.address}`}
            onClick={() =>
              setConfirm({
                title: "Revoke the compliance agent role?",
                label: "Revoke role",
                body: (
                  <p>
                    {row.address} will no longer be able to verify or revoke
                    investors in {fund.symbol}.
                  </p>
                ),
                run: () =>
                  void tx.run("Revoke compliance role", () =>
                    blockchain.setComplianceRole(
                      wallet.provider!,
                      wallet.account!,
                      fund,
                      row.address,
                      false,
                    ),
                  ),
              })
            }
          >
            Revoke
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="layout-halves">
        <Panel
          title="Transfer status"
          description="Pausing stops every transfer, subscription, inventory deposit and unsold-unit recovery in this fund. Forced transfers still work."
        >
          <div className="stack">
            <p>
              {fund.paused ? (
                <Pill tone="warn">Transfers paused</Pill>
              ) : (
                <Pill tone="ok">Transfers active</Pill>
              )}
            </p>
            <ActionButton
              variant={fund.paused ? "primary" : "danger"}
              reason={busy}
              onClick={() =>
                setConfirm({
                  title: fund.paused
                    ? "Resume transfers?"
                    : "Pause all transfers?",
                  label: fund.paused ? "Unpause" : "Pause",
                  body: (
                    <p>
                      {fund.paused
                        ? `Verified investors will be able to transfer and subscribe to ${fund.symbol} again.`
                        : `No ${fund.symbol} units will move until you unpause, except by forced transfer.`}
                    </p>
                  ),
                  run: () =>
                    void tx.run(fund.paused ? "Unpause" : "Pause", () =>
                      blockchain.setPaused(
                        wallet.provider!,
                        wallet.account!,
                        fund,
                        !fund.paused,
                      ),
                    ),
                })
              }
            >
              {fund.paused ? "Unpause transfers" : "Pause transfers"}
            </ActionButton>
          </div>
        </Panel>
        <Panel
          title="Forced transfer"
          description="Recovery after a lost key or a compliance removal. Revoke the holder's eligibility first, then move their units to a verified address."
        >
          <div className="form">
            <AddressField
              label="From (revoked holder)"
              value={fromInput}
              onChange={setFrom}
              error={from.error}
            />
            <AddressField
              label="To (verified recipient)"
              value={toInput}
              onChange={setTo}
              error={to.error}
            />
            <AmountField
              label="Units to move"
              symbol={fund.symbol}
              value={value}
              onChange={setValue}
              error={amountError}
              onMax={
                fromBalance.data
                  ? () => setValue(fromBalance.data!.toString())
                  : undefined
              }
            />
            <Checklist label="Forced transfer checks" checks={checks} />
            <ActionButton
              variant="danger"
              reason={forcedReason}
              onClick={() =>
                setConfirm({
                  title: "Force this transfer?",
                  label: "Force transfer",
                  body: (
                    <p>
                      Move {units(amount ?? 0n)} {fund.symbol} from {from.value}{" "}
                      to {to.value} without the holder's signature. The event
                      log records it as a forced transfer.
                    </p>
                  ),
                  run: () =>
                    void tx.run("Forced transfer", () =>
                      blockchain.forcedTransfer(
                        wallet.provider!,
                        wallet.account!,
                        fund,
                        from.value,
                        to.value,
                        value,
                      ),
                    ),
                })
              }
            >
              Force transfer
            </ActionButton>
          </div>
        </Panel>
      </div>
      <Panel
        title="Compliance agents"
        description="Addresses that can verify and revoke investors in this fund. The issuer's token admin role cannot be revoked."
        flush
      >
        <div className="toolbar">
          <AddressField
            className="field--grow"
            label="Grant the role to"
            value={agentInput}
            onChange={setAgent}
            error={agent.error}
          />
          <ActionButton
            reason={
              busy ??
              (!agent.value
                ? "Enter an address."
                : agents.some(
                      (a) =>
                        a.address.toLowerCase() === agent.value.toLowerCase(),
                    )
                  ? "Already a compliance agent."
                  : undefined)
            }
            onClick={() =>
              void tx.run("Grant compliance role", () =>
                blockchain.setComplianceRole(
                  wallet.provider!,
                  wallet.account!,
                  fund,
                  agent.value,
                  true,
                ),
              )
            }
          >
            Grant role
          </ActionButton>
        </div>
        <DataTable
          caption={`${fund.symbol} compliance agents`}
          columns={agentColumns}
          rows={registry.data ? agents : undefined}
          rowKey={(row) => row.address}
          loading={registry.loading}
          empty={
            <EmptyState>No address holds the compliance agent role.</EmptyState>
          }
        />
      </Panel>
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          confirmLabel={confirm.label}
          danger
          onClose={() => setConfirm(undefined)}
          onConfirm={confirm.run}
        >
          {confirm.body}
        </ConfirmDialog>
      )}
    </>
  );
}

/** Issuer dashboard: D5 pause, forced transfer and compliance-role delegation. */
export default function TokenControls() {
  const wallet = useWallet();
  return (
    <IssuerFrame
      title="Token controls"
      description="Emergency and administrative controls for the token contract. Each action requires the token admin role."
      allowed={(own) => own.tokenAdmin}
      denied="Only a token admin of this fund (DEFAULT_ADMIN_ROLE) can use these controls."
      regulated={(fund) => (
        <Notice title="Not available for regulated funds">
          The regulated token for {fund.symbol} has no pause, forced transfer or
          compliance-agent roles. Transfer rules are set in{" "}
          <Link to={`/compliance?asset=${fund.id}`}>Compliance</Link>.
        </Notice>
      )}
    >
      {(fund) => <Controls key={`${wallet.session}:${fund.id}`} fund={fund} />}
    </IssuerFrame>
  );
}
