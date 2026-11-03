import { useState } from "react";
import { Link } from "react-router-dom";
import type { Holding } from "../types";
import { useAssets, useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { blockchain } from "../services/blockchain";
import { address, quantity } from "../utils/validation";
import { categoryName, units } from "../utils/formatting";
import {
  Address,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
} from "../components/common";
import { TransactionHistory } from "../components/TransactionHistory";
export function TransferForm({ holding }: { holding: Holding }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision } = useData();
  const [recipient, setRecipient] = useState(""),
    [amount, setAmount] = useState("");
  let to = "",
    validation = "";
  try {
    to = address(recipient);
  } catch (error) {
    validation = (error as Error).message;
  }
  try {
    if (quantity(amount) > holding.balance)
      validation = "Insufficient token balance.";
  } catch (error) {
    validation = (error as Error).message;
  }
  const eligibility = useAsync(
    `recipient:${wallet.session}:${holding.asset.id}:${to}:${revision}`,
    () => blockchain.eligibility(holding.asset, to),
    !!to,
  );
  const enabled =
    !validation &&
    holding.eligible &&
    eligibility.data === true &&
    !tx.pending &&
    !wallet.wrongNetwork;
  return (
    <section className="panel">
      <p className="eyebrow">Wallet to wallet</p>
      <h2>Transfer {holding.asset.symbol}</h2>
      <p>
        Available:{" "}
        <strong>
          {units(holding.balance)} {holding.asset.symbol}
        </strong>
      </p>
      {!holding.eligible && (
        <p className="notice warning">
          Your eligibility has been revoked. Contact the issuer before
          transferring.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (enabled)
            void tx.run("Token transfer", () =>
              blockchain.transfer(
                wallet.provider!,
                wallet.account!,
                holding.asset,
                to,
                amount,
              ),
            );
        }}
      >
        <Field label="Recipient address">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
          />
        </Field>
        {to &&
          (eligibility.loading ? (
            <Loading>Checking recipient eligibility…</Loading>
          ) : eligibility.error ? (
            <ErrorMessage
              message={eligibility.error}
              retry={eligibility.reload}
            />
          ) : eligibility.data ? (
            <p className="notice success">
              Recipient is approved for this asset.
            </p>
          ) : (
            <p className="notice warning">
              This recipient is not authorised to hold the selected asset. The
              issuer must approve the recipient before this transfer can
              succeed.
            </p>
          ))}
        <Field label="Transfer quantity">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="20"
          />
        </Field>
        {amount && validation && (
          <p role="alert" className="field-error">
            {validation}
          </p>
        )}
        <div className="contract-target">
          <small>Token contract</small>
          <Address value={holding.asset.token} full />
        </div>
        <button className="button full" disabled={!enabled}>
          Transfer Tokens
        </button>
      </form>
    </section>
  );
}
export default function InvestorPortfolio() {
  const wallet = useWallet(),
    assets = useAssets(),
    { revision, refresh } = useData();
  const [selected, setSelected] = useState("");
  const holdings = useAsync(
    `holdings:${wallet.session}:${revision}:${assets.data?.map((a) => a.id).join(",")}`,
    () => blockchain.holdings(assets.data!, wallet.account!),
    !!wallet.account && !wallet.wrongNetwork && !!assets.data,
  );
  const owned = holdings.data?.filter((h) => h.balance > 0n) || [],
    chosen = owned.find((h) => h.asset.id === selected) || owned[0];
  return (
    <>
      <PageHeader
        eyebrow="Investor workspace"
        title="My portfolio"
        action={
          <button className="button secondary" onClick={refresh}>
            ↻ Refresh balances
          </button>
        }
      >
        Your on-chain holdings and transfer activity across registered assets.
      </PageHeader>
      {!wallet.account ? (
        <EmptyState title="Connect your wallet to view your portfolio">
          Balances and eligibility are retrieved directly from each token
          contract.
        </EmptyState>
      ) : wallet.wrongNetwork ? (
        <EmptyState title="Switch to the configured network" />
      ) : assets.loading || holdings.loading ? (
        <Loading>Loading portfolio balances…</Loading>
      ) : assets.error || holdings.error ? (
        <ErrorMessage
          message={assets.error || holdings.error!}
          retry={() => {
            assets.reload();
            holdings.reload();
          }}
        />
      ) : (
        <>
          {!owned.length ? (
            <EmptyState title="No tokens held">
              Explore the marketplace to find an offering. Issuer approval is
              required before purchasing.
            </EmptyState>
          ) : (
            <>
              <div className="section-heading">
                <h2>My tokenised assets</h2>
                <span className="subtle-tag">{owned.length} assets held</span>
              </div>
              <div className="portfolio-grid">
                {owned.map(({ asset, balance, eligible }) => (
                  <article
                    className={`holding-card ${chosen?.asset.id === asset.id ? "selected" : ""}`}
                    key={asset.id}
                  >
                    <span className="eyebrow">
                      {categoryName(asset.category)}
                    </span>
                    <h2>
                      <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
                    </h2>
                    <div className="holding-balance">
                      {units(balance)} <span>{asset.symbol}</span>
                    </div>
                    <p className={`badge ${eligible ? "positive" : "neutral"}`}>
                      {eligible ? "Approved investor" : "Eligibility revoked"}
                    </p>
                    <Address value={asset.token} />
                    <button
                      className="button secondary full"
                      onClick={() => setSelected(asset.id)}
                    >
                      Select for transfer
                    </button>
                  </article>
                ))}
              </div>
              {chosen && (
                <div className="narrow">
                  <TransferForm
                    key={`${wallet.session}:${chosen.asset.id}`}
                    holding={chosen}
                  />
                </div>
              )}
            </>
          )}
          {assets.data && (
            <TransactionHistory
              key={wallet.session}
              assets={assets.data}
              account={wallet.account}
            />
          )}
        </>
      )}
    </>
  );
}
