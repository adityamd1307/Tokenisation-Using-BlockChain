import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  hexlify,
  randomBytes,
  ZeroHash,
  type TransactionResponse,
} from "ethers";
import { useWallet } from "../context/WalletContext";
import { useAssets, useData } from "../context/DataContext";
import { useTransaction } from "../context/TransactionContext";
import { useAsync } from "../hooks/useAsync";
import { compliance, type CredentialInput } from "../services/compliance";
import {
  countries,
  identityReasons,
  transferReason,
} from "../utils/compliance";
import { Address, ErrorMessage, Field, Loading } from "../components/common";
import type { Asset } from "../types";

export default function CompliancePage() {
  const assets = useAssets(),
    wallet = useWallet(),
    [params, setParams] = useSearchParams();
  const regulated = assets.data?.filter((a) => a.identityRegistry) || [];
  const selected =
    regulated.find((a) => a.id === params.get("asset")) || regulated[0];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Simulated investor credentials</p>
        <h1>Compliance</h1>
        <p>
          ERC-3643-inspired Lite · Identity and asset policy are checked
          separately.
        </p>
      </div>
      {assets.loading && !assets.data ? (
        <Loading>Loading assets…</Loading>
      ) : assets.error ? (
        <ErrorMessage message={assets.error} retry={assets.reload} />
      ) : !selected ? (
        <section className="panel">
          <h2>No regulated assets</h2>
          <p>
            Create an asset using the regulated issuance mode to manage
            credentials and policies here. Existing assets retain their legacy
            whitelist.
          </p>
          <Link to="/issuer">Open issuer dashboard →</Link>
        </section>
      ) : (
        <>
          <Field label="Regulated asset">
            <select
              value={selected.id}
              onChange={(e) => setParams({ asset: e.target.value })}
            >
              {regulated.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.symbol})
                </option>
              ))}
            </select>
          </Field>
          <Workspace
            key={`${selected.token}:${wallet.session}:${wallet.account || "disconnected"}`}
            asset={selected}
          />
        </>
      )}
    </>
  );
}
function IdentityCard({
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
  if (state.loading) return <Loading>Checking identity…</Loading>;
  if (state.error || !state.data)
    return (
      <ErrorMessage
        message={state.error || "Identity unavailable"}
        retry={state.reload}
      />
    );
  const i = state.data;
  return (
    <div className="compliance-status">
      <Address value={who} full />
      {i.operational !== 0 && (
        <p className="notice info">
          Operational account:{" "}
          {
            (
              {
                1: "Issuer",
                2: "Sale escrow",
                3: "Subscription escrow",
              } as Record<number, string>
            )[i.operational]
          }
          . Investor credential rules do not apply to its custody inventory.
        </p>
      )}
      <p className={`badge ${i.status === 0 ? "positive" : "neutral"}`}>
        {identityReasons[i.status]}
      </p>
      <dl className="detail-list">
        <div>
          <dt>Identity</dt>
          <dd>{i.identityId === ZeroHash ? "Not registered" : "Registered"}</dd>
        </div>
        <div>
          <dt>Simulated KYC</dt>
          <dd>{i.kycApproved ? "Approved" : "Not approved"}</dd>
        </div>
        <div>
          <dt>Simulated accreditation</dt>
          <dd>{i.accredited ? "Approved" : "Not approved"}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>
            {countries.find((c) => c.code === i.country)?.name ||
              "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Credential expiry</dt>
          <dd>
            {i.validUntil
              ? new Date(Number(i.validUntil) * 1000).toLocaleString()
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Attestor currently trusted</dt>
          <dd>{i.trusted ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Revoked</dt>
          <dd>{i.revoked ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <small>
        Chain time: {new Date(Number(i.chainTime) * 1000).toLocaleString()}
      </small>
    </div>
  );
}
function Workspace({ asset }: { asset: Asset }) {
  const wallet = useWallet(),
    tx = useTransaction(),
    { revision, refresh } = useData();
  const [tick, setTick] = useState(0);
  useEffect(() => {
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
  const canWrite =
    !!wallet.account &&
    !!wallet.provider &&
    !wallet.wrongNetwork &&
    !tx.pending;
  const write = (label: string, action: () => Promise<TransactionResponse>) => {
    void tx.run(label, action);
  };
  const field =
    (key: keyof CredentialInput) => (e: { target: { value: string } }) =>
      setData((v) => ({ ...v, [key]: e.target.value }));
  const p = state.data;
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>{asset.name}</h2>
          <button className="button secondary" onClick={refresh}>
            Refresh compliance
          </button>
        </div>
        <p>
          ERC-3643-inspired Lite · Synthetic credentials only · KYC required for
          ordinary investor transfers
        </p>
        <div className="contract-grid">
          <div>
            <small>Identity registry</small>
            <Address value={asset.identityRegistry!} full />
          </div>
          <div>
            <small>Compliance policy</small>
            <Address value={asset.compliancePolicy!} full />
          </div>
        </div>
        {state.error ? (
          <ErrorMessage message={state.error} retry={state.reload} />
        ) : p ? (
          <dl className="detail-list">
            <div>
              <dt>Allowed jurisdictions</dt>
              <dd>
                {countries
                  .filter((_, i) => p.allowed[i])
                  .map((c) => c.name)
                  .join(", ") || "None — investor access closed"}
              </dd>
            </div>
            <div>
              <dt>Accreditation required</dt>
              <dd>{p.accredited ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Maximum wallet holdings</dt>
              <dd>
                {p.maximum.toString()} {asset.symbol}
              </dd>
            </div>
          </dl>
        ) : (
          <Loading>Loading policy…</Loading>
        )}
      </section>
      {wallet.account && (
        <section className="panel">
          <h2>Your investor identity</h2>
          <IdentityCard asset={asset} who={wallet.account} tick={tick} />
        </section>
      )}
      <div className="management-grid">
        <section className="panel">
          <h2>Identity lookup and credentials</h2>
          <p>
            Use only random synthetic IDs. Do not enter names, identity
            documents or hashes of personal data.
          </p>
          <Field label="Investor wallet">
            <input
              value={investor}
              onChange={(e) => {
                setInvestor(e.target.value);
                setLookup("");
              }}
              placeholder="0x…"
            />
          </Field>
          <button
            className="button secondary"
            onClick={() => setLookup(investor)}
            disabled={!investor}
          >
            Look up identity
          </button>
          {lookup && <IdentityCard asset={asset} who={lookup} tick={tick} />}
          {p?.attestor && (
            <>
              <Field label="Synthetic identity ID">
                <input value={data.identityId} onChange={field("identityId")} />
              </Field>
              <button
                className="button secondary"
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
                className="button secondary"
                disabled={!investor || tx.pending}
                onClick={() => {
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
                    .catch(() => setLookup(investor));
                }}
              >
                Load credential for renewal
              </button>
              <Field label="Investor country">
                <select value={data.country} onChange={field("country")}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Credential expiry">
                <input
                  type="datetime-local"
                  value={data.validUntil}
                  onChange={field("validUntil")}
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={data.kycApproved}
                  onChange={(e) =>
                    setData((v) => ({ ...v, kycApproved: e.target.checked }))
                  }
                />{" "}
                Simulated KYC approved
              </label>
              <br />
              <label>
                <input
                  type="checkbox"
                  checked={data.accredited}
                  onChange={(e) =>
                    setData((v) => ({ ...v, accredited: e.target.checked }))
                  }
                />{" "}
                Simulated accredited investor
              </label>
              <div className="actions">
                <button
                  className="button"
                  disabled={!canWrite}
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
                </button>
                <button
                  className="button secondary"
                  disabled={!canWrite}
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
                </button>
              </div>
            </>
          )}
          {(p?.identityAdmin || p?.attestor) && (
            <button
              className="button danger"
              disabled={!canWrite || !investor}
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
            </button>
          )}
          {!p?.attestor && (
            <p>
              Only trusted attestors can register or renew credentials. Platform
              administration does not itself grant attestation authority.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Transfer eligibility checker</h2>
          <p>
            This reads the token’s enforcement function. The transaction
            rechecks policy and balances; delegated transfers additionally
            require allowance.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCheck({ from, to, amount });
            }}
          >
            <Field label="Sender">
              <input
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setCheck(undefined);
                }}
                required
              />
            </Field>
            <Field label="Recipient">
              <input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setCheck(undefined);
                }}
                required
              />
            </Field>
            <Field label="Transfer amount">
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCheck(undefined);
                }}
                inputMode="numeric"
                required
              />
            </Field>
            <button className="button secondary">
              Check transfer eligibility
            </button>
          </form>
          {preflight.loading && <Loading>Checking transfer…</Loading>}
          {preflight.error && <ErrorMessage message={preflight.error} />}
          {preflight.data && (
            <div role="status" className="compliance-check">
              <h3>{transferReason(preflight.data.reason)}</h3>
              <p>
                Sender:{" "}
                {preflight.data.senderIdentity.operational
                  ? "Authorized custody"
                  : identityReasons[preflight.data.senderIdentity.status]}
              </p>
              <p>
                Recipient:{" "}
                {preflight.data.identity.operational
                  ? "Authorized custody"
                  : identityReasons[preflight.data.identity.status]}
              </p>
              <dl className="detail-list">
                <div>
                  <dt>Identity registered</dt>
                  <dd>
                    {preflight.data.identity.operational
                      ? "Custody exemption"
                      : preflight.data.identity.identityId !== ZeroHash
                        ? "PASS"
                        : "FAIL"}
                  </dd>
                </div>
                <div>
                  <dt>Credential valid / trusted attestor</dt>
                  <dd>
                    {preflight.data.identity.operational
                      ? "Custody exemption"
                      : preflight.data.identity.status === 0
                        ? "PASS"
                        : "FAIL"}
                  </dd>
                </div>
                <div>
                  <dt>Country / accreditation</dt>
                  <dd>
                    {preflight.data.recipientPolicy === 0
                      ? "PASS"
                      : transferReason(preflight.data.recipientPolicy)}
                  </dd>
                </div>
                <div>
                  <dt>Holding limit</dt>
                  <dd>
                    {preflight.data.policyTransfer === 5
                      ? "FAIL"
                      : preflight.data.policyTransfer === 0
                        ? "PASS"
                        : "Not evaluated: recipient policy failed"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>
      {p?.identityAdmin && (
        <section className="panel">
          <h2>Trusted attestors</h2>
          <p>
            Removing trust immediately invalidates credentials issued by that
            attestor. Another trusted attestor can renew them.
          </p>
          <Field label="Attestor wallet">
            <input
              value={attestor}
              onChange={(e) => setAttestor(e.target.value)}
            />
          </Field>
          <div className="actions">
            <button
              className="button"
              disabled={!canWrite}
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
            </button>
            <button
              className="button danger"
              disabled={!canWrite}
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
            </button>
          </div>
        </section>
      )}
      {p?.policyAdmin && (
        <section className="panel">
          <h2>Asset policy administration</h2>
          <p>
            Policy changes affect future transfers and claims. Existing
            balances, allocations and refund rights are preserved.
          </p>
          <Field label="Policy country">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="actions">
            <button
              className="button"
              disabled={!canWrite}
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
            </button>
            <button
              className="button secondary"
              disabled={!canWrite}
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
            </button>
          </div>
          <Field label="New maximum wallet holdings">
            <input
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <button
            className="button secondary"
            disabled={!canWrite}
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
          </button>
          <button
            className="button secondary"
            disabled={!canWrite}
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
          </button>
        </section>
      )}
      <p className="notice info">
        Claims that fail compliance stay reserved until credentials or policy
        permit delivery. Stablecoin refunds remain independent. A wallet cap is
        not a per-person ownership cap.
      </p>
    </>
  );
}
