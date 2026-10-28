import { useState } from "react";
import { useAssets, useData } from "../context/DataContext";
import { AssetCard } from "../components/AssetCard";
import {
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
} from "../components/common";
export default function Marketplace() {
  const assets = useAssets(),
    { refresh } = useData();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all");
  const data = assets.data || [];
  const filtered = data.filter(
    (a) =>
      `${a.name} ${a.symbol}`.toLowerCase().includes(query.toLowerCase()) &&
      (category === "all" || a.category === Number(category)) &&
      (status === "all" || a.closed === (status === "closed")),
  );
  return (
    <>
      <PageHeader
        eyebrow="Explore the registry"
        title="Asset marketplace"
        action={
          <button className="button secondary" onClick={refresh}>
            ↻ Refresh registry
          </button>
        }
      >
        Discover tokenised real-world and digital assets. Every offering,
        recorded on Ethereum.
      </PageHeader>
      <div className="overview-grid">
        <div className="overview-stat">
          <span>Registered assets</span>
          <strong>
            {assets.data ? data.length.toString().padStart(2, "0") : "—"}
          </strong>
          <small>Independent token contracts</small>
        </div>
        <div className="overview-stat">
          <span>Active offerings</span>
          <strong>
            {assets.data
              ? data
                  .filter((a) => !a.closed)
                  .length.toString()
                  .padStart(2, "0")
              : "—"}
          </strong>
          <small>Open for eligible investors</small>
        </div>
        <div className="overview-stat feature-stat">
          <span className="eyebrow">Built on Ethereum</span>
          <strong>Transparent by design.</strong>
          <small>Fixed supply. On-chain eligibility. Direct settlement.</small>
        </div>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <h2>Explore assets</h2>
            <p>Browse the primary issuance registry</p>
          </div>
          <span className="subtle-tag">ERC-20 · Whole units</span>
        </div>
        <div className="filter-bar">
          <label className="search-input">
            <span aria-hidden>⌕</span>
            <input
              aria-label="Search assets"
              placeholder="Search by asset name or symbol…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Asset category filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All asset categories</option>
            <option value="0">Real-world assets</option>
            <option value="1">Digital assets</option>
          </select>
          <select
            aria-label="Offering status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All offering statuses</option>
            <option value="active">Active offerings</option>
            <option value="closed">Closed offerings</option>
          </select>
        </div>
        {assets.loading ? (
          <Loading>Loading asset registry…</Loading>
        ) : assets.error ? (
          <ErrorMessage message={assets.error} retry={assets.reload} />
        ) : !filtered.length ? (
          <EmptyState
            title={
              data.length ? "No matching assets" : "No assets registered yet"
            }
          >
            {data.length
              ? "Try another name, symbol or filter."
              : "An authorised issuer can create the first tokenised asset from the issuer dashboard."}
          </EmptyState>
        ) : (
          <div className="asset-grid">
            {filtered.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>
      <div className="market-note">
        <span className="note-icon" aria-hidden>
          ⓘ
        </span>
        <div>
          <strong>Eligibility is specific to each asset.</strong>
          <p>
            Browse freely. To purchase or transfer tokens, your wallet must be
            approved by that asset’s issuer.
          </p>
        </div>
      </div>
    </>
  );
}
