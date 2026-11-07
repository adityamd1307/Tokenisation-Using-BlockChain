import { useState } from "react";
import { useAssets } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { blockchain } from "../services/blockchain";
import { useAsync } from "../hooks/useAsync";
import { useData } from "../context/DataContext";
import { useIssuerDirectory } from "../hooks/data";
import { address } from "../utils/validation";
import type { IssuerRow } from "../types";
import { Address, Pill } from "../components/ui/display";
import { DataTable, type Column } from "../components/ui/table";
import { ActionButton, AddressField } from "../components/ui/forms";
import {
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { ConnectPrompt } from "../components/shell/ConnectPrompt";

// Phase 4 required wording for issuer revocation.
const REVOKE_NOTE =
  "Revoking issuer permission prevents this wallet from creating new assets. Existing asset-token and sale contracts are not automatically deleted or frozen.";

function Console() {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData(),
    assets = useAssets();
  const directory = useIssuerDirectory(true);
  const [input, setInput] = useState(""),
    [confirm, setConfirm] = useState<string>();
  let target = "",
    error: string | undefined;
  if (input.trim())
    try {
      target = address(input);
    } catch (e) {
      error = (e as Error).message;
    }
  const status = useAsync(
    `issuer-status:${target}:${revision}`,
    () => blockchain.issuerStatus(target),
    !!target,
  );
  const busy = tx.pending ? "Another transaction is in progress." : undefined;
  const isAdmin = target.toLowerCase() === wallet.account?.toLowerCase();
  const authorise = (who: string, approved: boolean) =>
    void tx.run(approved ? "Authorise issuer" : "Revoke issuer", () =>
      blockchain.authorizeIssuer(
        wallet.provider!,
        wallet.account!,
        who,
        approved,
      ),
    );
  const columns: Column<IssuerRow>[] = [
    {
      key: "address",
      header: "Issuer",
      render: (row) => <Address value={row.address} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Pill tone={row.authorised ? "ok" : "neutral"}>
          {row.authorised ? "Authorised" : "Revoked"}
        </Pill>
      ),
    },
    {
      key: "funds",
      header: "Funds issued",
      align: "right",
      render: (row) =>
        (assets.data ?? [])
          .filter((a) => a.issuer.toLowerCase() === row.address.toLowerCase())
          .length.toLocaleString("en-US"),
    },
    {
      key: "changed",
      header: "Last change",
      align: "right",
      render: (row) => `Block ${row.changedBlock.toLocaleString("en-US")}`,
    },
    {
      key: "actions",
      header: "Actions",
      hideLabel: true,
      render: (row) => (
        <span className="cell-actions">
          {row.authorised ? (
            <button
              className="btn btn--danger btn--sm"
              disabled={!!busy}
              aria-label={`Revoke ${row.address}`}
              onClick={() => setConfirm(row.address)}
            >
              Revoke
            </button>
          ) : (
            <button
              className="btn btn--secondary btn--sm"
              disabled={!!busy}
              aria-label={`Authorise ${row.address}`}
              onClick={() => authorise(row.address, true)}
            >
              Authorise
            </button>
          )}
        </span>
      ),
    },
  ];
  return (
    <>
      <Panel
        title="Authorise an issuer"
        description="An authorised issuer can create funds through the factory."
      >
        <div className="form">
          <AddressField
            label="Issuer address"
            value={input}
            onChange={setInput}
            error={error}
            status={
              !target
                ? undefined
                : status.loading
                  ? { tone: "pending", text: "Checking issuer status…" }
                  : status.error
                    ? { tone: "err", text: status.error }
                    : status.data
                      ? { tone: "ok", text: "Authorised issuer" }
                      : { tone: "err", text: "Not authorised" }
            }
          />
          <div className="row">
            <ActionButton
              reason={
                busy ??
                (!target
                  ? "Enter a valid address."
                  : isAdmin
                    ? "The platform administrator cannot also be an issuer."
                    : status.data === undefined
                      ? "Checking issuer status…"
                      : status.data
                        ? "Already authorised."
                        : undefined)
              }
              onClick={() => authorise(target, true)}
            >
              Authorise issuer
            </ActionButton>
            {target && status.data && (
              <ActionButton
                variant="danger"
                reason={busy}
                onClick={() => setConfirm(target)}
              >
                Revoke authorisation
              </ActionButton>
            )}
          </div>
        </div>
      </Panel>
      <Panel
        title="Issuers"
        description="Every address the factory has authorised, from IssuerAuthorised and IssuerRevoked events."
        flush
        footer={
          <span className="row">
            Factory <Address value={blockchain.config.AssetFactory} />
          </span>
        }
      >
        <DataTable
          caption="Issuers"
          columns={columns}
          rows={directory.data}
          rowKey={(row) => row.address}
          loading={directory.loading}
          empty={<EmptyState>No issuer has been authorised yet.</EmptyState>}
        />
      </Panel>
      {confirm && (
        <ConfirmDialog
          title="Revoke issuer permission?"
          confirmLabel="Revoke"
          danger
          onClose={() => setConfirm(undefined)}
          onConfirm={() => authorise(confirm, false)}
        >
          <p>{REVOKE_NOTE}</p>
          <Address value={confirm} full />
        </ConfirmDialog>
      )}
    </>
  );
}

/** Administration: AssetFactory.authorizeIssuer / revokeIssuer (platform admin). */
export default function Administration() {
  const wallet = useWallet();
  const ready = wallet.account && !wallet.wrongNetwork;
  return (
    <div className="page">
      <PageHeader
        title="Issuer authorisations"
        description="Control which wallets may create funds on the platform."
      />
      {!ready ? (
        <ConnectPrompt purpose="manage issuers" />
      ) : !wallet.roles ? (
        <Notice>Checking administrator permission…</Notice>
      ) : !wallet.roles.admin ? (
        <Notice tone="warn" title="Administrator access required">
          This wallet is not the platform administrator.
        </Notice>
      ) : (
        <Console key={wallet.session} />
      )}
    </div>
  );
}
