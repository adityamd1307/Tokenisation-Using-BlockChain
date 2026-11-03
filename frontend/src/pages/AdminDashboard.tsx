import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useData } from "../context/DataContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { address } from "../utils/validation";
import {
  Address,
  ConfirmDialog,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
} from "../components/common";

export default function AdminDashboard() {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [value, setValue] = useState(""),
    [lookup, setLookup] = useState(""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const status = useAsync(
    `issuer-status:${lookup}:${revision}`,
    () => blockchain.issuerStatus(lookup),
    !!lookup,
  );
  const authorised = wallet.roles?.admin && !wallet.wrongNetwork;
  return (
    <>
      <PageHeader eyebrow="Platform governance" title="Administration">
        Manage permission to issue new tokenised assets on this platform.
      </PageHeader>
      {!wallet.account ? (
        <EmptyState title="Connect the administrator wallet">
          Use the platform administrator account to manage issuer permissions.
        </EmptyState>
      ) : wallet.wrongNetwork ? (
        <EmptyState title="Switch to the configured network" />
      ) : !wallet.roles && !wallet.error ? (
        <Loading>Checking administrator permission…</Loading>
      ) : !authorised ? (
        <EmptyState title="Administrator access required">
          This wallet is not the platform administrator.
        </EmptyState>
      ) : (
        <section className="panel narrow">
          <p className="eyebrow">Issuer permissions</p>
          <h2>Authorise an asset issuer</h2>
          <p>Look up a wallet before changing its platform permission.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setLookup(address(value));
                setError("");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <Field label="Issuer Ethereum address">
              <input
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setLookup("");
                }}
                placeholder="0x…"
              />
            </Field>
            <button className="button secondary" disabled={tx.pending}>
              Check issuer status
            </button>
          </form>
          {error && <ErrorMessage message={error} />}
          {lookup && (
            <div className="lookup-result">
              <Address value={lookup} full />
              {status.loading ? (
                <Loading>Checking issuer status…</Loading>
              ) : status.error ? (
                <ErrorMessage message={status.error} retry={status.reload} />
              ) : (
                <>
                  <p
                    className={`badge ${status.data ? "positive" : "neutral"}`}
                  >
                    {status.data ? "Authorised issuer" : "Not authorised"}
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={tx.pending || status.data}
                      onClick={() =>
                        void tx.run("Issuer authorisation", () =>
                          blockchain.authorizeIssuer(
                            wallet.provider!,
                            wallet.account!,
                            lookup,
                            true,
                          ),
                        )
                      }
                    >
                      Authorise Issuer
                    </button>
                    <button
                      className="button danger"
                      disabled={tx.pending || !status.data}
                      onClick={() => setConfirm(true)}
                    >
                      Revoke authorisation
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="footnote">
            The factory exposes address lookup rather than a full issuer
            directory. The platform administrator cannot authorise its own
            wallet.
          </p>
          <div className="contract-target">
            <small>Factory contract</small>
            <Address value={blockchain.config.AssetFactory} full />
          </div>
        </section>
      )}
      {confirm && (
        <ConfirmDialog
          title="Revoke issuer permission?"
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            void tx.run("Issuer revocation", () =>
              blockchain.authorizeIssuer(
                wallet.provider!,
                wallet.account!,
                lookup,
                false,
              ),
            )
          }
        >
          <p>
            Revoking issuer permission prevents this wallet from creating new
            assets. Existing asset-token and sale contracts are not
            automatically deleted or frozen.
          </p>
          <Address value={lookup} full />
        </ConfirmDialog>
      )}
    </>
  );
}
