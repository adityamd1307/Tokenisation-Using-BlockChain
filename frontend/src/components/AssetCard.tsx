import { Link } from "react-router-dom";
import type { Asset } from "../types";
import { categoryName, eth, units } from "../utils/formatting";
import { Address, Status } from "./common";
export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <article className="asset-card">
      <div className={`asset-banner category-${asset.category}`}>
        <span className="asset-symbol">{asset.symbol.slice(0, 5)}</span>
        <span className="asset-category">{categoryName(asset.category)}</span>
        <span className="asset-pattern" aria-hidden>
          ▤
        </span>
      </div>
      <div className="asset-card-body">
        <div className="card-meta">
          <Status closed={asset.closed} />
          <span className="muted">#{asset.id.padStart(3, "0")}</span>
        </div>
        <h2>
          <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
        </h2>
        <p className="card-description">
          {asset.description || "No description provided by the issuer."}
        </p>
        <div className="card-issuer">
          <span>Issuer</span>
          <Address value={asset.issuer} />
        </div>
        <dl className="asset-metrics">
          <div>
            <dt>Price per token</dt>
            <dd>
              {eth(asset.price)} <small>ETH</small>
            </dd>
          </div>
          <div>
            <dt>Available inventory</dt>
            <dd>
              {units(asset.inventory)} <small>{asset.symbol}</small>
            </dd>
          </div>
        </dl>
        <div className="card-bottom">
          <span>{units(asset.totalSupply)} total supply</span>
          <Link className="text-link" to={`/assets/${asset.id}`}>
            View asset <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
