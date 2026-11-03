import { useState } from "react";
import type { Asset } from "../types";
import { useWallet } from "../context/WalletContext";
import { useData } from "../context/DataContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { address, quantity } from "../utils/validation";
import { eth, units } from "../utils/formatting";
import {
  Address,
  ConfirmDialog,
  ErrorMessage,
  Field,
  Loading,
  Status,
} from "./common";
import { TransactionHistory } from "./TransactionHistory";
type Confirmation = { title: string; message: string; execute: () => void };
export function IssuerManagement({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [investor, setInvestor] = useState(""),
    [lookup, setLookup] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirmation>();
  const state = useAsync(
    `issuer:${wallet.session}:${asset.id}:${revision}`,
    () => blockchain.account(asset, wallet.account!),
  );
  const eligibility = useAsync(
    `eligibility:${asset.id}:${lookup}:${revision}`,
    () => blockchain.eligibility(asset, lookup),
    !!lookup,
  );
  if (state.loading)
    return (
      <Loading>
        Loading issuer balances, allowance and compliance roles…
      </Loading>
    );
  if (state.error || !state.data)
    return (
      <ErrorMessage
        message={state.error || "Unable to read issuer state."}
        retry={state.reload}
      />
    );
  const current = state.data;
  let parsed = 0n,
    amountError = "";
  try {
    parsed = quantity(amount);
    if (parsed > current.balance)
      amountError = "Insufficient issuer token balance.";
  } catch (error) {
    amountError = (error as Error).message;
  }
  const write = (
    label: string,
    send: () => ReturnType<typeof blockchain.approve>,
  ) => {
    void tx.run(label, send);
  };
  const whitelist = (target: string, approved: boolean) =>
    write(approved ? "Eligibility approval" : "Eligibility revocation", () =>
      blockchain.whitelist(
        wallet.provider!,
        wallet.account!,
        asset,
        target,
        approved,
      ),
    );
  const manage = (
    operation:
      | "withdrawProceeds"
      | "closeSale"
      | "recoverUnsoldTokens"
      | "sweepExcessETH",
    title: string,
    message: string,
  ) =>
    setConfirm({
      title,
      message,
      execute: () =>
        write(title, () =>
          blockchain.manageSale(
            wallet.provider!,
            wallet.account!,
            asset,
            operation,
          ),
        ),
    });
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Manage asset #{asset.id}</p>
            <h2>
              {asset.name} <span className="muted">{asset.symbol}</span>
            </h2>
          </div>
          <Status closed={asset.closed} />
        </div>
        <div className="contract-grid">
          <div>
            <small>Token contract</small>
            <Address value={asset.token} full />
          </div>
          <div>
            <small>Sale contract</small>
            <Address value={asset.sale} full />
          </div>
        </div>
        <p>
          {units(asset.totalSupply)} total supply · {eth(asset.price)} ETH per
          token
        </p>
      </section>
      <div className="management-grid">
        <section className="panel">
          <p className="eyebrow">01 / Investor compliance</p>
          <h2>Investor eligibility</h2>
          <p>
            Eligibility applies only to {asset.symbol}. Revocation blocks both
            sending and receiving.
          </p>
          {!current.compliance && (
            <div className="notice warning">
              <p>This wallet does not hold COMPLIANCE_ROLE.</p>
              {current.tokenAdmin && (
                <button
                  className="button secondary"
                  disabled={tx.pending}
                  onClick={() =>
                    write("Restore compliance role", () =>
                      blockchain.restoreCompliance(
                        wallet.provider!,
                        wallet.account!,
                        asset,
                      ),
                    )
                  }
                >
                  Restore my compliance role
                </button>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setLookup(address(investor));
                setError("");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <Field label="Investor Ethereum address">
              <input
                value={investor}
                onChange={(e) => {
                  setInvestor(e.target.value);
                  setLookup("");
                }}
                placeholder="0x…"
              />
            </Field>
            <button className="button secondary" disabled={tx.pending}>
              Check eligibility
            </button>
          </form>
          {error && <ErrorMessage message={error} />}
          {lookup && (
            <div className="lookup-result">
              {eligibility.loading ? (
                <Loading>Checking investor eligibility…</Loading>
              ) : eligibility.error ? (
                <ErrorMessage
                  message={eligibility.error}
                  retry={eligibility.reload}
                />
              ) : (
                <>
                  <p>
                    {eligibility.data ? "Approved investor" : "Not approved"}
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={
                        tx.pending || !current.compliance || eligibility.data
                      }
                      onClick={() => whitelist(lookup, true)}
                    >
                      Approve Investor
                    </button>
                    <button
                      className="button danger"
                      disabled={
                        tx.pending || !current.compliance || !eligibility.data
                      }
                      onClick={() =>
                        setConfirm({
                          title: "Revoke investor eligibility?",
                          message: `Revoking eligibility blocks this address from sending or receiving this asset’s tokens, even if it already holds tokens. Address: ${lookup}`,
                          execute: () => whitelist(lookup, false),
                        })
                      }
                    >
                      Revoke eligibility
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="section-divider" />
          <h3>Sale contract eligibility</h3>
          <Address value={asset.sale} full />
          <p
            className={`badge ${current.saleEligible ? "positive" : "neutral"}`}
          >
            {current.saleEligible
              ? "Sale contract approved"
              : "Sale contract not approved"}
          </p>
          <button
            className="button secondary"
            disabled={tx.pending || !current.compliance || current.saleEligible}
            onClick={() => whitelist(asset.sale, true)}
          >
            Approve Sale Contract
          </button>
          {!current.eligible && (
            <div className="notice warning">
              <p>
                Your issuer wallet is not whitelisted; deposits and recovery are
                blocked.
              </p>
              <button
                className="button secondary"
                disabled={tx.pending || !current.compliance}
                onClick={() => whitelist(wallet.account!, true)}
              >
                Restore issuer eligibility
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">02 / Primary inventory</p>
          <h2>Fund this offering</h2>
          <dl className="detail-list compact">
            <div>
              <dt>Issuer balance</dt>
              <dd>
                {units(current.balance)} {asset.symbol}
              </dd>
            </div>
            <div>
              <dt>Sale inventory</dt>
              <dd>
                {units(asset.inventory)} {asset.symbol}
              </dd>
            </div>
            <div>
              <dt>Spending allowance</dt>
              <dd>
                {units(current.allowance)} {asset.symbol}
              </dd>
            </div>
          </dl>
          <Field label="Deposit quantity">
            <input
              value={amount}
              inputMode="numeric"
              placeholder="5000"
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {amount && amountError && (
            <p className="field-error" role="alert">
              {amountError}
            </p>
          )}
          {!current.saleEligible && (
            <p className="notice warning">
              Approve the sale contract’s eligibility first.
            </p>
          )}
          {amount && !amountError && current.allowance < parsed && (
            <p className="notice info">
              Approve {units(parsed)} tokens before depositing. Your current
              allowance is insufficient.
            </p>
          )}
          <div className="actions vertical">
            <button
              className="button secondary"
              disabled={
                tx.pending ||
                asset.closed ||
                !current.saleEligible ||
                !!amountError
              }
              onClick={() =>
                write("Token spending approval", () =>
                  blockchain.approve(
                    wallet.provider!,
                    wallet.account!,
                    asset,
                    amount,
                  ),
                )
              }
            >
              1. Approve Token Spending
            </button>
            <button
              className="button"
              disabled={
                tx.pending ||
                asset.closed ||
                !current.saleEligible ||
                !current.eligible ||
                !!amountError ||
                current.allowance < parsed
              }
              onClick={() =>
                write("Inventory deposit", () =>
                  blockchain.deposit(
                    wallet.provider!,
                    wallet.account!,
                    asset,
                    amount,
                  ),
                )
              }
            >
              2. Deposit Tokens
            </button>
          </div>
          <p className="footnote">
            Approval and deposit are separate transactions. Approval permits
            exactly the entered quantity; it does not move tokens.
          </p>
        </section>
        <section className="panel">
          <p className="eyebrow">03 / Sale proceeds</p>
          <h2>Manage proceeds</h2>
          <dl className="detail-list compact">
            <div>
              <dt>Contract ETH balance</dt>
              <dd>{eth(asset.saleEth)} ETH</dd>
            </div>
            <div>
              <dt>Unclaimed sale proceeds</dt>
              <dd>{eth(asset.proceeds)} ETH</dd>
            </div>
            <div>
              <dt>Fixed price per token</dt>
              <dd>{eth(asset.price)} ETH</dd>
            </div>
          </dl>
          <small>Withdrawal recipient</small>
          <Address value={asset.issuer} full />
          <button
            className="button full"
            disabled={tx.pending || asset.proceeds === 0n}
            onClick={() =>
              manage(
                "withdrawProceeds",
                "Withdraw sale proceeds?",
                `Withdraw ${eth(asset.proceeds)} ETH to issuer ${asset.issuer}.`,
              )
            }
          >
            Withdraw Proceeds
          </button>
          {asset.saleEth > asset.proceeds && (
            <button
              className="button secondary full"
              disabled={tx.pending}
              onClick={() =>
                manage(
                  "sweepExcessETH",
                  "Recover excess ETH?",
                  `Recover ${eth(asset.saleEth - asset.proceeds)} ETH above the accounted sale proceeds to ${asset.issuer}.`,
                )
              }
            >
              Recover excess ETH
            </button>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">04 / Offering management</p>
          <h2>Close and recover inventory</h2>
          <p>
            Closing stops purchases and inventory deposits permanently. Unsold
            tokens can then be returned to the issuer.
          </p>
          <p>
            <strong>
              {units(asset.inventory)} {asset.symbol}
            </strong>{" "}
            remaining
          </p>
          <small>Recovery recipient</small>
          <Address value={asset.issuer} full />
          <div className="actions vertical">
            <button
              className="button danger"
              disabled={tx.pending || asset.closed}
              onClick={() =>
                manage(
                  "closeSale",
                  "Permanently close offering?",
                  `Closure cannot be undone. No further purchases or inventory deposits will be accepted by ${asset.sale}.`,
                )
              }
            >
              Close Offering
            </button>
            <button
              className="button secondary"
              disabled={
                tx.pending ||
                !asset.closed ||
                asset.inventory === 0n ||
                !current.saleEligible ||
                !current.eligible
              }
              onClick={() =>
                manage(
                  "recoverUnsoldTokens",
                  "Recover unsold tokens?",
                  `Return all ${units(asset.inventory)} ${asset.symbol} to issuer ${asset.issuer}. Both the sale and issuer must remain whitelisted.`,
                )
              }
            >
              Recover Unsold Tokens
            </button>
          </div>
        </section>
      </div>
      <TransactionHistory assets={[asset]} />
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          onClose={() => setConfirm(undefined)}
          onConfirm={confirm.execute}
        >
          <p>{confirm.message}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
