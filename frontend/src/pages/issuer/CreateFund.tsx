import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useWallet } from "../../context/WalletContext";
import { useTransaction } from "../../context/TransactionContext";
import { useWorkspace } from "../../hooks/useRole";
import { blockchain } from "../../services/blockchain";
import { creationArgs, type CreateAssetInput } from "../../utils/validation";
import { eth, units } from "../../utils/formatting";
import type { Asset } from "../../types";
import { Address, Facts } from "../../components/ui/display";
import {
  ActionButton,
  SelectField,
  Summary,
  TextAreaField,
  TextField,
} from "../../components/ui/forms";
import { Notice, PageHeader, Panel } from "../../components/ui/layout";
import { ConnectPrompt } from "../../components/shell/ConnectPrompt";

const initial: CreateAssetInput = {
  name: "",
  symbol: "",
  description: "",
  category: "0",
  supply: "",
  price: "",
};

/** AssetFactory.createAsset (authorised issuer only). */
function CreateForm() {
  const wallet = useWallet(),
    tx = useTransaction();
  const [input, setInput] = useState(initial),
    [created, setCreated] = useState<Asset>(),
    [note, setNote] = useState("");
  const set = (key: keyof CreateAssetInput) => (value: string) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  let args: ReturnType<typeof creationArgs> | undefined,
    error: string | undefined;
  try {
    args = creationArgs(input);
  } catch (e) {
    error = (e as Error).message;
  }
  const touched = input.name || input.symbol || input.supply || input.price;
  const submit = async () => {
    setCreated(undefined);
    setNote("");
    const receipt = await tx.run("Create fund", () =>
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
          return;
        }
      }
    } catch {
      setNote(
        "The fund was created. Refresh the fund registry to see its contract addresses.",
      );
    }
  };
  return (
    <div className="layout-split">
      <Panel title="New fund">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!error && !tx.pending) void submit();
          }}
        >
          <div className="form-grid">
            <TextField
              label="Fund name"
              value={input.name}
              onChange={set("name")}
              placeholder="Campus Property Token"
            />
            <TextField
              label="Symbol"
              value={input.symbol}
              onChange={set("symbol")}
              placeholder="CPT"
            />
          </div>
          <TextAreaField
            label="Description"
            value={input.description}
            onChange={set("description")}
            hint="Stored on-chain and public. Do not include private information."
          />
          <div className="form-grid">
            <SelectField
              label="Asset type"
              value={input.category}
              onChange={set("category")}
              options={[
                { value: "0", label: "Real-world asset" },
                { value: "1", label: "Digital asset" },
              ]}
            />
            <TextField
              label="Total supply"
              value={input.supply}
              onChange={set("supply")}
              inputMode="numeric"
              mono
              suffix="units"
              placeholder="10000"
            />
          </div>
          <TextField
            label="Price per unit"
            value={input.price}
            onChange={set("price")}
            inputMode="decimal"
            mono
            suffix="ETH"
            placeholder="0.001"
            hint="Fixed at creation. It cannot be changed later."
            error={touched && input.supply && input.price ? error : undefined}
          />
          {args && (
            <Summary
              sentence={`Creates ${args[1]} with ${units(args[4])} units minted to your wallet, offered at ${eth(args[5])} ETH per unit.`}
            />
          )}
          <ActionButton
            type="submit"
            reason={
              tx.pending
                ? "Another transaction is in progress."
                : error
                  ? touched
                    ? error
                    : "Fill in the fund details."
                  : undefined
            }
          >
            Create fund
          </ActionButton>
        </form>
      </Panel>
      <div className="stack">
        {created ? (
          <Panel title="Fund created">
            <div className="stack">
              <Facts
                compact
                label="Created fund"
                items={[
                  {
                    label: "Fund",
                    value: `${created.name} (${created.symbol})`,
                  },
                  { label: "Fund ID", value: created.id },
                  { label: "Token", value: <Address value={created.token} /> },
                  { label: "Sale", value: <Address value={created.sale} /> },
                ]}
              />
              <p className="secondary small">
                Next: verify the sale contract in the{" "}
                <Link to={`/issuer/${created.id}/registry`}>
                  investor registry
                </Link>
                , then approve and deposit units on the{" "}
                <Link to={`/issuer/${created.id}/offering`}>offering</Link>{" "}
                page.
              </p>
            </div>
          </Panel>
        ) : (
          <Panel title="What happens">
            <p className="secondary small">
              The factory deploys a token contract and a sale contract for the
              fund. The full supply is minted to your wallet. Investors cannot
              subscribe until you verify the sale contract and deposit units
              into it.
            </p>
          </Panel>
        )}
        {note && <Notice>{note}</Notice>}
      </div>
    </div>
  );
}

export default function CreateFund() {
  const wallet = useWallet();
  const workspace = useWorkspace();
  const ready = wallet.account && !wallet.wrongNetwork;
  return (
    <div className="page">
      <PageHeader
        title="Create fund"
        description="Deploy a new fund token and its fixed-price sale through the platform factory."
      />
      {!ready ? (
        <ConnectPrompt purpose="create a fund" />
      ) : !wallet.roles ? (
        <Notice>Checking issuer authorisation…</Notice>
      ) : !wallet.roles.issuer ? (
        <Notice tone="warn" title="Not an authorised issuer">
          This wallet cannot create new funds. The platform administrator must
          authorise it.
          {workspace.managed.length > 0 &&
            " Funds you already issued stay manageable from the issuer dashboard."}
        </Notice>
      ) : (
        <CreateForm key={wallet.session} />
      )}
    </div>
  );
}

/** /issuer: the first managed fund's registry, or the create page. */
export function IssuerHome() {
  const workspace = useWorkspace();
  const wallet = useWallet();
  if (!wallet.account || wallet.wrongNetwork)
    return (
      <div className="page">
        <PageHeader title="Issuer dashboard" />
        <ConnectPrompt purpose="use the issuer dashboard" />
      </div>
    );
  if (workspace.loading)
    return (
      <div className="page">
        <PageHeader title="Issuer dashboard" />
        <Notice>Checking your roles…</Notice>
      </div>
    );
  if (workspace.managed[0])
    return (
      <Navigate
        to={`/issuer/${workspace.managed[0].assetId}/registry`}
        replace
      />
    );
  if (workspace.issuer) return <Navigate to="/issuer/create" replace />;
  return (
    <div className="page">
      <PageHeader title="Issuer dashboard" />
      <Notice tone="warn" title="Issuer role required">
        This wallet is not an authorised issuer and holds no role in any fund.
      </Notice>
    </div>
  );
}
