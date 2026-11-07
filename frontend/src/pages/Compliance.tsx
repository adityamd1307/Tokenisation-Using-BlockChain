// Compliance workspace for regulated (ERC-3643-inspired Lite) funds, ported from
// main's CompliancePage (PRs #3 and #4) into the new design. Reads and writes go
// through services/compliance.ts unchanged.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  hexlify,
  randomBytes,
  ZeroHash,
  type TransactionResponse,
} from "ethers";
import { useAssets, useData } from "../context/DataContext";
import { useWallet } from "../context/WalletContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { compliance, type CredentialInput } from "../services/compliance";
import {
  countries,
  identityReasons,
  transferReason,
} from "../utils/compliance";
import { formatTime } from "../utils/formatting";
import type { Asset } from "../types";
import { Address, Facts, Pill, Skeleton } from "../components/ui/display";
import {
  ActionButton,
  AddressField,
  CheckboxField,
  SelectField,
  TextField,
} from "../components/ui/forms";
import {
  EmptyState,
  ErrorNotice,
  Notice,
  PageHeader,
  Panel,
} from "../components/ui/layout";
import { targetNetwork } from "../config/networks";

const operationalNames: Record<number, string> = {
  1: "Issuer",
  2: "Sale escrow",
  3: "Subscription escrow",
};

function IdentityFacts({
  asset,
  who,
  tick,
}: {
  asset: Asset;
  who: string;
  tick: number;
}) {
  const { revision } = useData();
  const state = useAsync(
    `identity:${asset.token}:${who}:${revision}:${tick}`,
    () => compliance.identity(asset, who),
  );
  if (state.error && !state.data)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  const i = state.data;
  if (!i)
    return (
      <div className="stack stack--tight" aria-busy="true">
        <Skeleton />
        <Skeleton short />
      </div>
    );
  return (
    <div className="stack stack--tight">
      <div className="row">
        <Address value={who} />
        <Pill tone={i.status === 0 ? "ok" : "warn"}>
          {identityReasons[i.status]}
        </Pill>
      </div>
      {i.operational !== 0 && (
        <Notice>
          Operational account: {operationalNames[i.operational]}. Investor
          credential rules do not apply to its custody inventory.
        </Notice>
      )}
      <Facts
        compact
        label={`Identity of ${who}`}
        items={[
          {
            label: "Identity",
            value: i.identityId === ZeroHash ? "Not registered" : "Registered",
          },
          {
            label: "Simulated KYC",
            value: i.kycApproved ? "Approved" : "Not approved",
          },
          {
            label: "Simulated accreditation",
            value: i.accredited ? "Approved" : "Not approved",
          },
          {
            label: "Country",
            value:
              countries.find((c) => c.code === i.country)?.name ??
              "Not recorded",
          },
          {
            label: "Credential expiry",
            value: i.validUntil
              ? formatTime(Number(i.validUntil))
              : "Not recorded",
          },
          { label: "Attestor trusted", value: i.trusted ? "Yes" : "No" },
          { label: "Revoked", value: i.revoked ? "Yes" : "No" },
        ]}
      />
      <p className="muted small">
        Chain time {formatTime(Number(i.chainTime))}
      </p>
    </div>
  );
}

function Workspace({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision, refresh } = useData();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // Credential expiry depends on chain time; re-read it periodically.
    const id = setInterval(() => setTick((v) => v + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const state = useAsync(
    `policy:${asset.token}:${wallet.session}:${revision}:${tick}`,
    () => compliance.state(asset, wallet.account || undefined),
  );
  const [investor, setInvestor] = useState(""),
    [lookup, setLookup] = useState(""),
    [attestor, setAttestor] = useState("");
  const [data, setData] = useState<CredentialInput>({
    identityId: hexlify(randomBytes(32)),
    country: "702",
    kycApproved: true,
    accredited: true,
    validUntil: "",
  });
  const [maximum, setMaximum] = useState("500"),
    [country, setCountry] = useState("702");
  // AUD-018: the sender default is the resolved account (this component is keyed by it).
  const [from, setFrom] = useState(wallet.account || asset.issuer),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState("100");
  const [check, setCheck] = useState<{
    from: string;
    to: string;
    amount: string;
  }>();
  const preflight = useAsync(
    `check:${asset.token}:${check?.from}:${check?.to}:${check?.amount}:${revision}:${tick}`,
    () => compliance.check(asset, check!.from, check!.to, check!.amount),
    !!check,
  );
  const blocked = !wallet.account
    ? "Connect a wallet first."
    : wallet.wrongNetwork
      ? `Switch to ${targetNetwork.name} first.`
      : tx.pending
        ? "Another transaction is in progress."
        : undefined;
  const needsInvestor = investor.trim()
    ? undefined
    : "Enter an investor wallet.";
  const write = (label: string, action: () => Promise<TransactionResponse>) =>
    void tx.run(label, action);
  const p = state.data;
  const pass = (ok: boolean): ReactNode => (
    <Pill tone={ok ? "ok" : "err"}>{ok ? "Pass" : "Fail"}</Pill>
  );
  return (
    <>
      <Panel
        title={`${asset.name} (${asset.symbol})`}
        description="ERC-3643-inspired Lite. Synthetic credentials only. Identity and asset policy are checked separately."
        actions={
          <button className="btn btn--ghost btn--sm" onClick={refresh}>
            <RefreshCw aria-hidden />
            Refresh compliance
          </button>
        }
        flush
      >
        {state.error && !p ? (
          <div className="panel__body">
            <ErrorNotice message={state.error} retry={state.reload} />
          </div>
        ) : (
          <Facts
            label="Asset policy"
            items={[
              {
                label: "Allowed jurisdictions",
                value: p ? (
                  countries
                    .filter((_, i) => p.allowed[i])
                    .map((c) => c.name)
                    .join(", ") || "None. Investor access is closed."
                ) : (
                  <Skeleton />
                ),
              },
              {
                label: "Accreditation required",
                value: p ? p.accredited ? "Yes" : "No" : <Skeleton short />,
              },
              {
                label: "Maximum wallet holdings",
                value: p ? (
                  `${p.maximum.toLocaleString("en-US")} ${asset.symbol}`
                ) : (
                  <Skeleton short />
                ),
              },
              {
                label: "Identity registry",
                value: <Address value={asset.identityRegistry!} />,
              },
              {
                label: "Compliance policy",
                value: <Address value={asset.compliancePolicy!} />,
              },
            ]}
          />
        )}
      </Panel>
      {wallet.account && (
        <Panel title="Your investor identity">
          <IdentityFacts asset={asset} who={wallet.account} tick={tick} />
        </Panel>
      )}
      <div className="layout-halves">
        <Panel
          title="Identity lookup and credentials"
          description="Use only random synthetic IDs. Do not enter names, identity documents or hashes of personal data."
        >
          <div className="form">
            <AddressField
              label="Investor wallet"
              value={investor}
              onChange={(value) => {
                setInvestor(value);
                setLookup("");
              }}
            />
            <div className="row">
              <button
                className="btn btn--secondary btn--sm"
                disabled={!investor}
                onClick={() => setLookup(investor)}
              >
                Look up identity
              </button>
            </div>
            {lookup && <IdentityFacts asset={asset} who={lookup} tick={tick} />}
            {p?.attestor && (
              <>
                <TextField
                  label="Synthetic identity ID"
                  value={data.identityId}
                  mono
                  onChange={(identityId) =>
                    setData((v) => ({ ...v, identityId }))
                  }
                />
                <div className="row">
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() =>
                      setData((v) => ({
                        ...v,
                        identityId: hexlify(randomBytes(32)),
                      }))
                    }
                  >
                    Generate synthetic ID
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    disabled={!investor || tx.pending}
                    onClick={() =>
                      void compliance
                        .identity(asset, investor)
                        .then((i) =>
                          setData({
                            identityId: i.identityId,
                            country: String(i.country || 702),
                            kycApproved: i.kycApproved,
                            accredited: i.accredited,
                            validUntil: i.validUntil
                              ? new Date(
                                  Number(i.validUntil) * 1000 -
                                    new Date().getTimezoneOffset() * 60000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : "",
                          }),
                        )
                        .catch(() => setLookup(investor))
                    }
                  >
                    Load credential for renewal
                  </button>
                </div>
                <div className="form-grid">
                  <SelectField
                    label="Investor country"
                    value={data.country}
                    onChange={(value) =>
                      setData((v) => ({ ...v, country: value }))
                    }
                    options={countries.map((c) => ({
                      value: String(c.code),
                      label: `${c.name} (${c.code})`,
                    }))}
                  />
                  <div className="field">
                    <label className="field__label" htmlFor="credential-expiry">
                      Credential expiry
                    </label>
                    <div className="field__control">
                      <input
                        id="credential-expiry"
                        className="field__input"
                        type="datetime-local"
                        value={data.validUntil}
                        onChange={(e) =>
                          setData((v) => ({ ...v, validUntil: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <CheckboxField
                  label="Simulated KYC approved"
                  checked={data.kycApproved}
                  onChange={(kycApproved) =>
                    setData((v) => ({ ...v, kycApproved }))
                  }
                />
                <CheckboxField
                  label="Simulated accredited investor"
                  checked={data.accredited}
                  onChange={(accredited) =>
                    setData((v) => ({ ...v, accredited }))
                  }
                />
                <div className="row">
                  <ActionButton
                    reason={blocked ?? needsInvestor}
                    onClick={() =>
                      write("Register identity", () =>
                        compliance.attest(
                          wallet.provider!,
                          wallet.account!,
                          asset,
                          investor,
                          data,
                          false,
                        ),
                      )
                    }
                  >
                    Register identity
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    reason={blocked ?? needsInvestor}
                    onClick={() =>
                      write("Renew identity", () =>
                        compliance.attest(
                          wallet.provider!,
                          wallet.account!,
                          asset,
                          investor,
                          data,
                          true,
                        ),
                      )
                    }
                  >
                    Renew identity
                  </ActionButton>
                </div>
              </>
            )}
            {(p?.identityAdmin || p?.attestor) && (
              <ActionButton
                variant="danger"
                reason={
                  blocked ??
                  (!investor ? "Enter an investor wallet." : undefined)
                }
                onClick={() =>
                  write("Revoke identity", () =>
                    compliance.revoke(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      investor,
                    ),
                  )
                }
              >
                Revoke credential
              </ActionButton>
            )}
            {!p?.attestor && (
              <p className="muted small">
                Only trusted attestors can register or renew credentials.
                Platform administration does not itself grant attestation
                authority.
              </p>
            )}
          </div>
        </Panel>
        <Panel
          title="Transfer eligibility checker"
          description="Reads the token’s own enforcement function. The transaction rechecks policy and balances."
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setCheck({ from, to, amount });
            }}
          >
            <AddressField
              label="Sender"
              value={from}
              onChange={(value) => {
                setFrom(value);
                setCheck(undefined);
              }}
            />
            <AddressField
              label="Recipient"
              value={to}
              onChange={(value) => {
                setTo(value);
                setCheck(undefined);
              }}
            />
            <TextField
              label="Transfer amount"
              value={amount}
              mono
              inputMode="numeric"
              suffix={asset.symbol}
              onChange={(value) => {
                setAmount(value);
                setCheck(undefined);
              }}
            />
            <div className="row">
              <button className="btn btn--secondary" type="submit">
                Check transfer eligibility
              </button>
            </div>
          </form>
          {preflight.loading && (
            <p className="muted small">Checking transfer…</p>
          )}
          {preflight.error && <ErrorNotice message={preflight.error} />}
          {preflight.data && (
            <div className="stack stack--tight" role="status">
              <h3>{transferReason(preflight.data.reason)}</h3>
              <Facts
                compact
                label="Transfer check"
                items={[
                  {
                    label: "Sender",
                    value: preflight.data.senderIdentity.operational
                      ? "Authorised custody"
                      : identityReasons[preflight.data.senderIdentity.status],
                  },
                  {
                    label: "Recipient",
                    value: preflight.data.identity.operational
                      ? "Authorised custody"
                      : identityReasons[preflight.data.identity.status],
                  },
                  {
                    label: "Identity registered",
                    value: preflight.data.identity.operational
                      ? "Custody exemption"
                      : pass(preflight.data.identity.identityId !== ZeroHash),
                  },
                  {
                    label: "Credential valid",
                    value: preflight.data.identity.operational
                      ? "Custody exemption"
                      : pass(preflight.data.identity.status === 0),
                  },
                  {
                    label: "Country and accreditation",
                    value:
                      preflight.data.recipientPolicy === 0
                        ? pass(true)
                        : transferReason(preflight.data.recipientPolicy),
                  },
                  {
                    label: "Holding limit",
                    value:
                      preflight.data.policyTransfer === 5
                        ? pass(false)
                        : preflight.data.policyTransfer === 0
                          ? pass(true)
                          : "Not evaluated: recipient policy failed",
                  },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>
      {p?.identityAdmin && (
        <Panel
          title="Trusted attestors"
          description="Removing trust immediately invalidates credentials issued by that attestor. Another trusted attestor can renew them."
        >
          <div className="form">
            <AddressField
              label="Attestor wallet"
              value={attestor}
              onChange={setAttestor}
            />
            <div className="row">
              <ActionButton
                reason={blocked}
                onClick={() =>
                  write("Trust attestor", () =>
                    compliance.trust(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      attestor,
                      true,
                    ),
                  )
                }
              >
                Trust attestor
              </ActionButton>
              <ActionButton
                variant="danger"
                reason={blocked}
                onClick={() =>
                  write("Remove attestor trust", () =>
                    compliance.trust(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      attestor,
                      false,
                    ),
                  )
                }
              >
                Remove trust
              </ActionButton>
            </div>
          </div>
        </Panel>
      )}
      {p?.policyAdmin && (
        <Panel
          title="Asset policy administration"
          description="Policy changes affect future transfers and claims. Existing balances, allocations and refund rights are preserved."
        >
          <div className="form">
            <SelectField
              label="Policy country"
              value={country}
              onChange={setCountry}
              options={countries.map((c) => ({
                value: String(c.code),
                label: c.name,
              }))}
            />
            <div className="row">
              <ActionButton
                reason={blocked}
                onClick={() =>
                  write("Allow jurisdiction", () =>
                    compliance.updatePolicy(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      "setCountryAllowed",
                      country,
                      true,
                    ),
                  )
                }
              >
                Allow country
              </ActionButton>
              <ActionButton
                variant="secondary"
                reason={blocked}
                onClick={() =>
                  write("Restrict jurisdiction", () =>
                    compliance.updatePolicy(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      "setCountryAllowed",
                      country,
                      false,
                    ),
                  )
                }
              >
                Restrict country
              </ActionButton>
            </div>
            <TextField
              label="New maximum wallet holdings"
              value={maximum}
              onChange={setMaximum}
              mono
              inputMode="numeric"
              suffix={asset.symbol}
            />
            <div className="row">
              <ActionButton
                variant="secondary"
                reason={blocked}
                onClick={() =>
                  write("Update holding limit", () =>
                    compliance.updatePolicy(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      "setMaxWalletHolding",
                      maximum,
                      false,
                    ),
                  )
                }
              >
                Update holding limit
              </ActionButton>
              <ActionButton
                variant="secondary"
                reason={blocked}
                onClick={() =>
                  write("Update accreditation policy", () =>
                    compliance.updatePolicy(
                      wallet.provider!,
                      wallet.account!,
                      asset,
                      "setAccreditationRequired",
                      "",
                      !p.accredited,
                    ),
                  )
                }
              >
                {p.accredited
                  ? "Make accreditation optional"
                  : "Require accreditation"}
              </ActionButton>
            </div>
          </div>
        </Panel>
      )}
      <Notice>
        Claims that fail compliance stay reserved until credentials or policy
        permit delivery. Stablecoin refunds remain independent. A wallet cap is
        not a per-person ownership cap.
      </Notice>
    </>
  );
}

/** Compliance (regulated funds only): identity, transfer checker, attestors, policy. */
export default function Compliance() {
  const wallet = useWallet(),
    assets = useAssets(),
    [params, setParams] = useSearchParams();
  const regulated = assets.data?.filter((a) => a.identityRegistry) ?? [];
  const selected =
    regulated.find((a) => a.id === params.get("asset")) ?? regulated[0];
  return (
    <div className="page">
      <PageHeader
        title="Compliance"
        description="Simulated investor credentials and per-fund transfer policy for regulated funds."
        actions={
          regulated.length > 1 &&
          selected && (
            <SelectField
              label="Regulated fund"
              value={selected.id}
              onChange={(id) => setParams({ asset: id })}
              options={regulated.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.symbol})`,
              }))}
            />
          )
        }
      />
      {assets.error && !assets.data ? (
        <ErrorNotice message={assets.error} retry={assets.reload} />
      ) : assets.loading && !assets.data ? (
        <Panel title="Loading">
          <Skeleton />
        </Panel>
      ) : !selected ? (
        // main's AUD-016: no compliance reads are mounted when nothing is regulated.
        <Panel title="No regulated assets">
          <EmptyState
            action={<Link to="/issuer/create">Create a regulated fund</Link>}
          >
            Funds created in regulated mode are managed here. Existing funds
            keep their whitelist.
          </EmptyState>
        </Panel>
      ) : (
        <Workspace
          key={`${selected.token}:${wallet.session}:${wallet.account || "disconnected"}`}
          asset={selected}
        />
      )}
    </div>
  );
}
