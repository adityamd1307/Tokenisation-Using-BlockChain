import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useData } from "../context/DataContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { categoryName, eth, units } from "../utils/formatting";
import { payment, quantity } from "../utils/validation";
import {
  Address,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
  Status,
} from "../components/common";
import { TransactionHistory } from "../components/TransactionHistory";
import type { Asset } from "../types";

export function PurchasePanel({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [value, setValue] = useState("");
  const state = useAsync(
    `purchase:${wallet.session}:${asset.id}:${revision}`,
    () => blockchain.account(asset, wallet.account!),
    !!wallet.account && !wallet.wrongNetwork,
  );
  let cost = 0n,
    validation = "";
  try {
    const amount = quantity(value);
    cost = payment(amount, asset.price);
    if (amount > asset.inventory)
      validation = "The offering has insufficient token inventory.";
  } catch (error) {
    validation = (error as Error).message;
  }
  const allowed =
    !!wallet.account &&
    !wallet.wrongNetwork &&
    !!state.data?.eligible &&
    !!state.data?.saleEligible &&
    !asset.closed &&
    !validation &&
    !tx.pending &&
    !state.loading;
  return (
    <section className="panel purchase-panel">
      <p className="eyebrow">Primary offering</p>
      <h2>Purchase tokens</h2>
      <div className="price-display">
        {eth(asset.price)} <span>ETH / {asset.symbol}</span>
      </div>
      {!wallet.account ? (
        <p className="notice info">
          Connect your wallet to purchase this asset.
        </p>
      ) : wallet.wrongNetwork ? (
        <p className="notice warning">
          Switch to the configured network to purchase.
        </p>
      ) : state.loading ? (
        <Loading>Checking investor eligibility…</Loading>
      ) : state.error ? (
        <ErrorMessage message={state.error} retry={state.reload} />
      ) : (
        <>
          <p
            className={`notice ${state.data?.eligible ? "success" : "warning"}`}
          >
            {state.data?.eligible
              ? "Eligible investor — You may purchase this asset."
              : "Your wallet is not currently authorised to acquire this asset. Contact the asset issuer for approval."}
          </p>
          <p>
            Your balance{" "}
            <strong>
              {units(state.data?.balance || 0n)} {asset.symbol}
            </strong>
          </p>
          {!state.data?.saleEligible && (
            <p className="notice warning">
              The sale contract is not whitelisted. Contact the issuer.
            </p>
          )}
        </>
      )}
      {asset.closed && (
        <p className="notice warning">This offering is permanently closed.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (allowed)
            void tx.run("Token purchase", () =>
              blockchain.buy(wallet.provider!, wallet.account!, asset, value),
            );
        }}
      >
        <Field
          label="Quantity of tokens"
          hint={`${units(asset.inventory)} ${asset.symbol} available · whole tokens only`}
        >
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="100"
          />
        </Field>
        {value && validation && (
          <p className="field-error" role="alert">
            {validation}
          </p>
        )}
        <dl className="payment-summary">
          <div>
            <dt>Total payment</dt>
            <dd>{eth(cost)} ETH</dd>
          </div>
          <div>
            <dt>Network fees</dt>
            <dd>Calculated by your wallet</dd>
          </div>
        </dl>
        <div className="contract-target">
          <small>Payment contract</small>
          <Address value={asset.sale} full />
        </div>
        <button className="button full" disabled={!allowed}>
          Purchase Tokens <span aria-hidden>↗</span>
        </button>
      </form>
    </section>
  );
}
export default function AssetPage() {
  const { id = "" } = useParams(),
    wallet = useWallet(),
    { revision } = useData();
  const state = useAsync(`asset:${id}:${revision}`, async () => {
    await blockchain.ready();
    return blockchain.asset(id);
  });
  if (state.loading) return <Loading>Loading asset details…</Loading>;
  if (state.error || !state.data)
    return (
      <ErrorMessage
        message={state.error || "Asset not found."}
        retry={state.reload}
      />
    );
  const asset = state.data;
  return (
    <>
      <Link to="/" className="back-link">
        ← Back to marketplace
      </Link>
      <PageHeader
        eyebrow={`${categoryName(asset.category)} · Registry #${asset.id}`}
        title={asset.name}
        action={<Status closed={asset.closed} />}
      >
        {asset.description || "No description provided by the issuer."}
      </PageHeader>
      <div className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Asset overview</p>
          <h2>
            {asset.symbol} <span className="muted">/ Token information</span>
          </h2>
          <dl className="detail-list">
            <div>
              <dt>Total fixed supply</dt>
              <dd>
                {units(asset.totalSupply)} {asset.symbol}
              </dd>
            </div>
            <div>
              <dt>Available inventory</dt>
              <dd>
                {units(asset.inventory)} {asset.symbol}
              </dd>
            </div>
            <div>
              <dt>Price per token</dt>
              <dd>{eth(asset.price)} ETH</dd>
            </div>
            <div>
              <dt>Issuer wallet</dt>
              <dd>
                <Address value={asset.issuer} full />
              </dd>
            </div>
            <div>
              <dt>Token contract</dt>
              <dd>
                <Address value={asset.token} full />
              </dd>
            </div>
            <div>
              <dt>Sale contract</dt>
              <dd>
                <Address value={asset.sale} full />
              </dd>
            </div>
          </dl>
          <p className="footnote">
            Contract addresses can be copied for inspection in your wallet or
            local RPC. No block explorer is configured for the local chain.
          </p>
        </section>
        <PurchasePanel key={`${id}:${wallet.session}`} asset={asset} />
      </div>
      <TransactionHistory assets={[asset]} />
    </>
  );
}
