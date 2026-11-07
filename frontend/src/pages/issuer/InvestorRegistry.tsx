import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useData } from "../../context/DataContext";
import { useWallet } from "../../context/WalletContext";
import { useTransaction } from "../../context/TransactionContext";
import { blockchain } from "../../services/blockchain";
import { address } from "../../utils/validation";
import { useEligibility, useRegistry } from "../../hooks/data";
import type { Asset, FundAccess, RegistryRow } from "../../types";
import { Address, Pill, Units } from "../../components/ui/display";
import { DataTable, type Column } from "../../components/ui/table";
import {
  ActionButton,
  AddressField,
  SelectField,
  TextField,
} from "../../components/ui/forms";
import {
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  Notice,
  Panel,
} from "../../components/ui/layout";
import { IssuerFrame } from "./IssuerFrame";

// Phase 4 §7.3 wording, shown before every revocation.
const REVOKE_WARNING =
  "Revoking eligibility blocks this address from sending or receiving this asset’s tokens, even if it already holds tokens.";

type Confirm = { address: string };

function Registry({ fund, own }: { fund: Asset; own: FundAccess }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    navigate = useNavigate();
  const registry = useRegistry(fund);
  const [input, setInput] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [confirm, setConfirm] = useState<Confirm>();
  let lookup = "",
    lookupError: string | undefined;
  if (input.trim())
    try {
      lookup = address(input);
    } catch (error) {
      lookupError = (error as Error).message;
    }
  const status = useEligibility(fund, lookup);
  const me = wallet.account!.toLowerCase();
  const labelFor = (a: string) =>
    a.toLowerCase() === fund.sale.toLowerCase()
      ? "Sale contract"
      : a.toLowerCase() === fund.issuer.toLowerCase()
        ? "Issuer"
        : a.toLowerCase() === me
          ? "You"
          : undefined;
  const busy = tx.pending ? "Another transaction is in progress." : undefined;
  const noRole = own.compliance
    ? undefined
    : "This wallet does not hold the compliance agent role for this fund.";
  const setWhitelisted = (target: string, approved: boolean) =>
    void tx.run(approved ? "Verify investor" : "Revoke eligibility", () =>
      blockchain.whitelist(
        wallet.provider!,
        wallet.account!,
        fund,
        target,
        approved,
      ),
    );
  const needle = query.trim().toLowerCase();
  const rows = registry.data
    ?.filter(
      (row) =>
        (!needle || row.address.toLowerCase().includes(needle)) &&
        (filter === "all" ||
          (filter === "verified" && row.eligible) ||
          (filter === "revoked" && !row.eligible) ||
          (filter === "holding" && row.balance > 0n)),
    )
    .sort((a, b) =>
      b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0,
    );
  const columns: Column<RegistryRow>[] = [
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <Address value={row.address} tag={labelFor(row.address)} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.eligible ? (
          <Pill tone="ok">Verified</Pill>
        ) : row.changedBlock !== undefined ? (
          <Pill tone="err">Revoked</Pill>
        ) : (
          <Pill tone="neutral">Not verified</Pill>
        ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (row) => <Units value={row.balance} symbol={fund.symbol} />,
    },
    {
      key: "roles",
      header: "Roles",
      render: (row) =>
        row.tokenAdmin || row.compliance ? (
          <span className="row">
            {row.tokenAdmin && <span className="tag">Token admin</span>}
            {row.compliance && <span className="tag">Compliance agent</span>}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: "changed",
      header: "Last change",
      align: "right",
      render: (row) =>
        row.changedBlock !== undefined
          ? `Block ${row.changedBlock.toLocaleString("en-US")}`
          : "—",
    },
    {
      key: "actions",
      header: "Actions",
      hideLabel: true,
      render: (row) => (
        <span className="cell-actions">
          {row.eligible ? (
            <button
              className="btn btn--danger btn--sm"
              disabled={!!(noRole || busy)}
              title={noRole ?? busy}
              onClick={() => setConfirm({ address: row.address })}
              aria-label={`Revoke eligibility of ${row.address}`}
            >
              Revoke
            </button>
          ) : (
            <button
              className="btn btn--secondary btn--sm"
              disabled={!!(noRole || busy)}
              title={noRole ?? busy}
              onClick={() => setWhitelisted(row.address, true)}
              aria-label={`Verify ${row.address}`}
            >
              Verify
            </button>
          )}
          {!row.eligible && row.balance > 0n && own.tokenAdmin && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() =>
                navigate(`/issuer/${fund.id}/controls?from=${row.address}`)
              }
              aria-label={`Forced transfer from ${row.address}`}
            >
              Forced transfer
            </button>
          )}
        </span>
      ),
    },
  ];
  return (
    <>
      {!own.compliance && (
        <Notice
          tone="warn"
          title="Compliance agent role required to change eligibility"
          action={
            own.tokenAdmin && (
              <button
                className="btn btn--secondary btn--sm"
                disabled={tx.pending}
                onClick={() =>
                  void tx.run("Restore compliance role", () =>
                    blockchain.restoreCompliance(
                      wallet.provider!,
                      wallet.account!,
                      fund,
                    ),
                  )
                }
              >
                Restore my compliance role
              </button>
            )
          }
        >
          This wallet can view the registry but cannot verify or revoke
          investors.
          {own.tokenAdmin &&
            " As token admin it can grant itself the role again."}
        </Notice>
      )}
      <Panel
        title="Check an address"
        description={`Eligibility is specific to ${fund.symbol}. Verifying an address here does not verify it for any other fund.`}
      >
        <div className="form">
          <AddressField
            label="Investor address"
            value={input}
            onChange={setInput}
            error={lookupError}
            status={
              !lookup
                ? undefined
                : status.loading
                  ? { tone: "pending", text: "Checking eligibility…" }
                  : status.error
                    ? { tone: "err", text: status.error }
                    : status.data
                      ? {
                          tone: "ok",
                          text: `Verified investor in ${fund.symbol}`,
                        }
                      : {
                          tone: "err",
                          text: `Not verified for ${fund.symbol}`,
                        }
            }
          />
          <div className="row">
            <ActionButton
              reason={
                !lookup
                  ? "Enter a valid address."
                  : (busy ??
                    noRole ??
                    (status.data === undefined
                      ? "Checking eligibility…"
                      : status.data
                        ? "Already verified."
                        : undefined))
              }
              onClick={() => setWhitelisted(lookup, true)}
            >
              Verify investor
            </ActionButton>
            {lookup && status.data && (
              <ActionButton
                variant="danger"
                reason={busy ?? noRole}
                onClick={() => setConfirm({ address: lookup })}
              >
                Revoke eligibility
              </ActionButton>
            )}
          </div>
        </div>
      </Panel>
      <Panel
        title="Registry"
        description="Every address that has been verified, held units or held a role in this fund, with its current on-chain state."
        flush
        actions={
          <button className="btn btn--ghost btn--sm" onClick={registry.reload}>
            <RefreshCw aria-hidden />
            Refresh
          </button>
        }
      >
        <div className="toolbar">
          <TextField
            className="field--grow"
            label="Search address"
            value={query}
            onChange={setQuery}
            mono
            placeholder="0x…"
          />
          <SelectField
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All addresses" },
              { value: "verified", label: "Verified" },
              { value: "revoked", label: "Not verified or revoked" },
              { value: "holding", label: "Holding units" },
            ]}
          />
        </div>
        {registry.error && !registry.data ? (
          <div className="panel__body">
            <ErrorNotice message={registry.error} retry={registry.reload} />
          </div>
        ) : (
          <DataTable
            caption={`${fund.symbol} investor registry`}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.address}
            loading={registry.loading}
            sticky
            empty={
              <EmptyState>
                {registry.data?.length
                  ? "No addresses match these filters."
                  : "No addresses yet. Verify an investor above to add the first one."}
              </EmptyState>
            }
          />
        )}
      </Panel>
      {confirm && (
        <ConfirmDialog
          title="Revoke investor eligibility?"
          confirmLabel="Revoke eligibility"
          danger
          onClose={() => setConfirm(undefined)}
          onConfirm={() => setWhitelisted(confirm.address, false)}
        >
          <p>{REVOKE_WARNING}</p>
          <p>
            Address: <Address value={confirm.address} full />
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

/** Issuer dashboard: per-fund investor whitelist (AssetToken.setWhitelisted). */
export default function InvestorRegistry() {
  const wallet = useWallet(),
    { refresh } = useData();
  return (
    <IssuerFrame
      title="Investor registry"
      description="Verify investors, revoke eligibility and review who holds units. A revoked holder keeps their balance but cannot send, receive or subscribe."
      allowed={(own) => own.compliance || own.tokenAdmin || own.saleIssuer}
      denied="This wallet holds no issuer, compliance agent or token admin role for this fund."
      regulated={(fund) => (
        <Notice
          title="Regulated fund"
          action={
            <Link
              className="btn btn--secondary"
              to={`/compliance?asset=${fund.id}`}
            >
              Open Compliance
            </Link>
          }
        >
          {fund.symbol} uses simulated identity credentials and a per-fund
          policy instead of a whitelist. Its sale contract is authorised for
          custody permanently.
        </Notice>
      )}
      actions={
        <button className="btn btn--secondary" onClick={refresh}>
          <RefreshCw aria-hidden />
          Refresh
        </button>
      }
    >
      {(fund, own) => (
        <Registry key={`${wallet.session}:${fund.id}`} fund={fund} own={own} />
      )}
    </IssuerFrame>
  );
}
