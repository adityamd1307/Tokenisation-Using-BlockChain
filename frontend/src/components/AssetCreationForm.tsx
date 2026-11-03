import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { blockchain } from "../services/blockchain";
import { creationArgs, type CreateAssetInput } from "../utils/validation";
import { Address, ErrorMessage, Field } from "./common";
import type { Asset } from "../types";
import { units } from "../utils/formatting";
const initial: CreateAssetInput = {
  name: "",
  symbol: "",
  description: "",
  category: "0",
  supply: "",
  price: "",
};
export function AssetCreationForm() {
  const wallet = useWallet(),
    tx = useTransaction();
  const [input, setInput] = useState(initial),
    [error, setError] = useState(""),
    [created, setCreated] = useState<Asset>();
  const field = (key: keyof CreateAssetInput) => ({
    value: input[key],
    onChange: (event: { target: { value: string } }) =>
      setInput((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const submit = async () => {
    setError("");
    setCreated(undefined);
    try {
      creationArgs(input);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    const receipt = await tx.run("Asset creation", () =>
      blockchain.createAsset(wallet.provider!, wallet.account!, input),
    );
    if (!receipt) return;
    try {
      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() !==
          blockchain.config.AssetFactory.toLowerCase()
        )
          continue;
        const parsed = blockchain.factory().interface.parseLog(log);
        if (parsed?.name === "AssetCreated") {
          setCreated(await blockchain.asset(parsed.args.assetId.toString()));
          setInput(initial);
          break;
        }
      }
    } catch {
      setError(
        "Asset creation confirmed. Refresh My Assets to retrieve the new contract addresses.",
      );
    }
  };
  return (
    <section className="panel">
      <p className="eyebrow">New issuance</p>
      <h2>Create a tokenised asset</h2>
      <p>
        The full supply is minted to your wallet. The fixed price cannot be
        changed later.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (wallet.roles?.issuer && !wallet.wrongNetwork) void submit();
        }}
      >
        <div className="form-grid">
          <Field label="Asset name">
            <input
              {...field("name")}
              placeholder="Campus Property Token"
              required
            />
          </Field>
          <Field label="Token symbol">
            <input {...field("symbol")} placeholder="CPT" required />
          </Field>
        </div>
        <Field
          label="Asset description"
          hint="Optional on-chain text. Do not include private information."
        >
          <textarea
            {...field("description")}
            placeholder="Describe this simulated asset…"
            rows={3}
          />
        </Field>
        <div className="form-grid">
          <Field label="Asset category">
            <select {...field("category")}>
              <option value="0">Real-world asset</option>
              <option value="1">Digital asset</option>
            </select>
          </Field>
          <Field label="Total token supply">
            <input
              {...field("supply")}
              inputMode="numeric"
              placeholder="10000"
              required
            />
          </Field>
          <Field label="Price per token (ETH)">
            <input
              {...field("price")}
              inputMode="decimal"
              placeholder="0.001"
              required
            />
          </Field>
        </div>
        {error && <ErrorMessage message={error} />}
        <div className="contract-target">
          <small>Factory contract</small>
          <Address value={blockchain.config.AssetFactory} full />
        </div>
        <button
          className="button"
          disabled={tx.pending || !wallet.roles?.issuer || wallet.wrongNetwork}
        >
          Create Asset
        </button>
      </form>
      {created && (
        <div className="notice success creation-result">
          <h3>Asset Created Successfully</h3>
          <p>
            {created.name} ({created.symbol}) · Asset ID {created.id} ·{" "}
            {units(created.totalSupply)} tokens
          </p>
          <p>
            Token contract <Address value={created.token} full />
          </p>
          <p>
            Sale contract <Address value={created.sale} full />
          </p>
          <Link to={`/assets/${created.id}`}>View asset →</Link>
        </div>
      )}
    </section>
  );
}
