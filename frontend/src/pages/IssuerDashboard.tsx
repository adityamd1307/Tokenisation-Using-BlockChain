import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useAssets, useData } from "../context/DataContext";
import { AssetCreationForm } from "../components/AssetCreationForm";
import { IssuerManagement } from "../components/IssuerManagement";
import {
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeader,
} from "../components/common";
export default function IssuerDashboard() {
  const wallet = useWallet(),
    assets = useAssets(),
    { refresh } = useData();
  const [selected, setSelected] = useState("");
  const owned =
    assets.data?.filter(
      (a) => a.issuer.toLowerCase() === wallet.account?.toLowerCase(),
    ) || [];
  const asset = owned.find((a) => a.id === selected) || owned[0];
  return (
    <>
      <PageHeader
        eyebrow="Issuance workspace"
        title="Issuer dashboard"
        action={
          <button className="button secondary" onClick={refresh}>
            ↻ Refresh assets
          </button>
        }
      >
        Create assets, manage eligibility and oversee the primary offering
        lifecycle.
      </PageHeader>
      {!wallet.account ? (
        <EmptyState title="Connect your issuer wallet">
          Create and manage assets using an authorised issuer account.
        </EmptyState>
      ) : wallet.wrongNetwork ? (
        <EmptyState title="Switch to the configured network" />
      ) : (
        <>
          {wallet.roles?.issuer ? (
            <AssetCreationForm key={wallet.session} />
          ) : (
            <div className="notice info">
              {wallet.roles
                ? "This wallet cannot create new assets. Existing assets remain manageable by their issuer."
                : "Checking permission to create assets…"}
            </div>
          )}
          {assets.loading && !assets.data ? (
            <Loading>Loading issuer assets…</Loading>
          ) : assets.error ? (
            <ErrorMessage message={assets.error} retry={assets.reload} />
          ) : !owned.length ? (
            <EmptyState title="No assets issued by this wallet">
              Your registered assets will appear here after creation.
            </EmptyState>
          ) : (
            <>
              <section className="asset-selector">
                <Field label="My assets">
                  <select
                    value={asset.id}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {owned.map((a) => (
                      <option key={a.id} value={a.id}>
                        #{a.id} · {a.name} ({a.symbol})
                        {a.closed ? " · Closed" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </section>
              <IssuerManagement
                key={`${wallet.session}:${asset.id}`}
                asset={asset}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
