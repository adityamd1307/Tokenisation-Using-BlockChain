# Whole-project manual testing guide

Use this guide to rehearse the application and test its important success, failure, permission and accounting paths. It covers **legacy whitelist assets, regulated Lite assets, direct ETH sales, subscriptions, identity/compliance administration, wallet behavior and recovery**.

This is a test plan, **not a claim that these manual tests have already passed**. Mark each case after observing the actual result. Browser/MetaMask testing supplements the automated suites; it cannot exhaust every input or replace adversarial contract tests.

## Contents

1. [Set up the local environment and wallets](#1-set-up-the-local-environment-and-wallets)
2. [Local console for contract-only cases](#2-local-console-for-contract-only-cases)
3. [Wallet, navigation and transaction behavior](#3-wallet-navigation-and-transaction-behavior)
4. [Platform administration and asset creation](#4-platform-administration-and-asset-creation)
5. [Identity and trusted attestors](#5-identity-and-trusted-attestors)
6. [Regulated transfers and asset policies](#6-regulated-transfers-and-asset-policies)
7. [Direct ETH sales](#7-direct-eth-sales)
8. [Legacy whitelist, pause and forced transfer](#8-legacy-whitelist-pause-and-forced-transfer)
9. [Subscription creation, custody and funding](#9-subscription-creation-custody-and-funding)
10. [Successful oversubscribed offering](#10-successful-oversubscribed-offering)
11. [Failed, undersubscribed and rounding cases](#11-failed-undersubscribed-and-rounding-cases)
12. [Compliance changes during subscriptions](#12-compliance-changes-during-subscriptions)
13. [Adversarial permissions and immutable configuration](#13-adversarial-permissions-and-immutable-configuration)
14. [History, presentation and resilience](#14-history-presentation-and-resilience)
15. [Automated backstop and sign-off](#15-automated-backstop-and-sign-off)

## How to use the checklist

- **UI** means perform the action in the React app and sign through your development wallet. A disabled control is a valid UI rejection, but does not prove the contract also rejects the operation.
- **Console** means use the local Node console in section 2 to test the actual contract when the UI hides the action. These use unlocked Hardhat signers, **not MetaMask**, so still perform the separate wallet tests.
- Each checklist row gives ordered actions and expected results. For negative tests, verify balances, allowances and liabilities as appropriate before and after.
- A transaction rejected before broadcast has no receipt or gas charge. A mined reverted transaction may consume gas even though token/payment state rolls back. Do not require an investor's ETH balance to be unchanged after a mined revert.
- Wait for **Confirmed successfully** before switching roles. After console transactions, use the page's refresh control, wait for its polling, or reload. Public state and account state can refresh at different times.
- Use a **fresh asset for each major section/scenario**. Do not reuse balances from an earlier scenario unless instructed. Asset IDs are assigned sequentially; record actual IDs and addresses rather than assuming an ID.
- Keep a result sheet: `Case ID | PASS/FAIL/BLOCKED | wallet | asset/offering | transaction hash | before/after values | screenshot/notes`.
- Run reset/network-failure tests last. Time travel affects the **entire local chain**, including every credential and offering. The demo now mines every two seconds. For exact-boundary console tests, temporarily disable interval mining with `await rpc.send('evm_setIntervalMining', [0])`; otherwise a new block can cross the boundary between your reads. Restore `[2000]` afterward. Run manual time-travel scenarios on a disposable demo; a future block cannot be moved backward to wall time.

## 1. Set up the local environment and wallets

### 1.1 Start or resume

From the project root, with the project's supported Node installation (the recorded development environment used Node 22):

```bash
npm ci
npm --prefix frontend ci
npm run compile
```

If dependencies are already installed and unchanged, you can skip reinstalling them.

**Terminal 1 — local chain:**

```bash
npm run node
```

If the existing node is already running on port 8545, reuse it. Starting a second node on the same port is not a reset. Restarting the original node destroys that node's in-memory state; only do that deliberately for a clean test run.

**Terminal 2 — fresh regulated deployment:**

```bash
npm run deploy:compliance:local
```

This creates a new regulated registry, seeded CPT, identity/policy contracts, MockUSD and SubscriptionFactory. It selects them in `frontend/src/config/addresses.json`, and saves the previous UI config to ignored `deployments/pre-compliance-localhost.json`. It does not migrate old assets. Copy that backup elsewhere before running the deployment command again if you need to retain an older configuration; the backup filename is reused.

Do **not** subsequently run `deploy:local`, `demo:local` or `deploy:subscriptions:local` for this combined walkthrough: they are separate workflows and can change the active setup. RegulatedAssetFactory already supports creating legacy assets too.

**Terminal 3 — frontend:**

```bash
npm --prefix frontend run dev -- --host 127.0.0.1
```

Open the URL Vite prints, normally `http://127.0.0.1:5173`. If Vite selects another port, use that actual port. Restart Vite after changing deployment configuration if the page has not picked up the new addresses.

### 1.2 Configure development wallets

Use a separate testing wallet/profile. Add/select the local network:

| Setting | Value |
|---|---|
| Network name | Hardhat Local |
| RPC | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | `ETH` |
| Explorer | Leave blank |

Import the **local development accounts** from your running Hardhat node into that testing wallet and label them as below. Those development keys are public test credentials; never use them for real assets or mix them with a funded personal wallet. Do not put keys in screenshots, the report or Git. Account names in MetaMask may start from 1; the table below uses **zero-based Hardhat indices**.

| Label | Index | Role in seeded CPT | Initial mUSD from deployment |
|---|---:|---|---:|
| A | 0 | Platform / identity administrator; MockUSD owner | 0 |
| B | 1 | Authorised issuer; CPT policy administrator | 0 |
| C | 2 | Trusted identity attestor; not automatically an asset issuer | 0 |
| D | 3 | Singapore, KYC approved, accredited | 10,000 |
| E | 4 | Singapore, KYC approved, **not accredited** | 10,000 |
| F | 5 | Singapore, **KYC denied**, accredited | 10,000 |
| G | 6 | India, KYC approved, accredited; country restricted for seeded CPT | 10,000 |
| H | 7 | Unregistered / unauthorised test wallet | 0 |
| I | 8 | Second issuer / alternate attestor when explicitly granted | 0 |

Seeded CPT: supply **10,000**, decimals **0**, ETH price **0.001**, cap **500**, accreditation required, only Singapore allowed. B initially owns all tokens. Direct-sale and subscription inventory are not pre-funded. Credentials expire after 30 chain days. F is initially **KYC-denied, not expired**; the expiry tests deliberately change a credential and advance time.

- [ ] **SET-01:** Start the app disconnected. Marketplace loads seeded CPT and its fixed price. Compliance shows the seeded policy; contract addresses match the current deployment.
- [ ] **SET-02:** Connect B. Verify 10,000 CPT in the issuer workspace, zero sale inventory and zero sale proceeds. Connect D: zero CPT and 10,000 mUSD on a subscription page once one exists.
- [ ] **SET-03:** Record the deployment file, chain ID, actual asset ID and wallet addresses. No private key or real identity data appears in evidence.

## 2. Local console for contract-only cases

Open a fourth terminal **at the repository root** and run `node`. Paste the following JavaScript into its interactive prompt; top-level `await` is supported. Keep this console open. These declarations intentionally use `var` so you can repeat setup after a redeployment.

```js
var { ethers } = await import('ethers');
var fs = await import('node:fs');
var rpc = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { cacheTimeout: -1 });
if ((await rpc.getNetwork()).chainId !== 31337n) throw new Error('Local chain 31337 only');
var cfg = JSON.parse(fs.readFileSync('frontend/src/config/addresses.json', 'utf8'));
if (!cfg.regulatedFactory) throw new Error('Run deploy:compliance:local for this guide');
var signers = await rpc.listAccounts();
var wallets = await Promise.all(signers.map(s => s.getAddress()));
console.table(wallets.slice(0, 9).map((address, index) => ({ index, address })));
var artifact = name => JSON.parse(fs.readFileSync(`artifacts/contracts/${name === 'ForceSendHarness' ? 'test/' : ''}${name}.sol/${name}.json`, 'utf8'));
var at = (name, address, index) => new ethers.Contract(address, artifact(name).abi, index === undefined ? rpc : signers[index]);
var factory = at('RegulatedAssetFactory', cfg.AssetFactory, 0);
var sf = at('SubscriptionFactory', cfg.SubscriptionFactory, 1);
var usd = at('MockUSD', cfg.MockUSD, 0);
var U = text => ethers.parseUnits(String(text), 6);
var ETHER = text => ethers.parseEther(String(text));
var tx = async pending => {
  var receipt = await (await pending).wait();
  if (receipt.status !== 1) throw new Error('Transaction did not succeed');
  console.log('Confirmed:', receipt.hash);
  return receipt;
};
var reject = async action => {
  try { await tx(action()); }
  catch (error) {
    if (error.code !== 'CALL_EXCEPTION') throw error;
    console.log('Contract rejection; inspect reason:', error.shortMessage, error.revert, error.data);
    return;
  }
  throw new Error('FAIL: action unexpectedly succeeded');
};
var now = async () => (await rpc.getBlock('latest')).timestamp;
var mineAt = async timestamp => {
  timestamp = Number(timestamp);
  if (timestamp <= await now()) throw new Error('Choose a timestamp later than current chain time');
  await rpc.send('evm_setNextBlockTimestamp', [timestamp]);
  await rpc.send('evm_mine', []);
};
var asset, token, sale, registry, policy, offering, offeringAddress;
var selectAsset = async id => {
  asset = await factory.getAsset(BigInt(id));
  var modules = await factory.modules(BigInt(id));
  var regulated = modules.identityRegistry !== ethers.ZeroAddress;
  token = at(regulated ? 'RegulatedAssetToken' : 'AssetToken', asset.tokenContract, 1);
  sale = at('AssetSale', asset.saleContract, 1);
  registry = regulated ? at('IdentityRegistryLite', modules.identityRegistry, 0) : undefined;
  policy = regulated ? at('ComplianceLite', modules.compliance, 1) : undefined;
  console.log({ id: String(asset.assetId), token: asset.tokenContract, sale: asset.saleContract, regulated });
};
var selectOffering = async address => {
  if (!await sf.isOffering(address)) throw new Error('Not a registered offering');
  offeringAddress = address;
  offering = at('SubscriptionOffering', address, 1);
  await selectAsset(await sf.assetIdOf(address));
};
var inspect = async () => ({
  supply: String(await token.totalSupply()),
  issuer: String(await token.balanceOf(wallets[1])),
  D: String(await token.balanceOf(wallets[3])),
  E: String(await token.balanceOf(wallets[4])),
  F: String(await token.balanceOf(wallets[5])),
  saleInventory: String(await token.balanceOf(asset.saleContract)),
  saleProceedsWei: String(await sale.unclaimedProceeds())
});
```

Use `await selectAsset('ACTUAL_ID')` with an ID you recorded. Use `await selectOffering('0xACTUAL_OFFERING_ADDRESS')` after creating an offering. **These overwrite the active console variables**; reselect the intended asset whenever you switch scenarios. `registry` and `policy` are undefined for a legacy asset.

`reject(...)` must report the **intended** contract failure. A failure caused by missing inventory, wrong timing or allowance does not prove an identity test. RPC/network/nonce errors are not passing results. Use `console.log(await inspect())` before/after token tests.

### 2.1 Reusable fresh-asset preparation

For a new regulated asset created through **B → Issuer dashboard → Create Asset**, record its ID, select it in the console, then use the following optional setup shortcut. It grants C trust, allows Singapore, and registers D/E/F as valid accredited investors **only in this new asset's registry**. It does not change seeded CPT's invalid personas. Skip the shortcut in section 5, which tests these actions through the UI.

```js
await tx(registry.grantRole(await registry.TRUSTED_ATTESTOR_ROLE(), wallets[2]));
await tx(policy.setCountryAllowed(702, true));
var expiry = await now() + 30 * 86400;
var credential = (index, overrides = {}) => ({
  identityId: ethers.id(`manual-synthetic-${asset.tokenContract}-${index}`),
  country: 702, kycApproved: true, accredited: true, validUntil: expiry,
  ...overrides
});
for (var index of [3, 4, 5]) {
  await tx(registry.connect(signers[2]).registerIdentity(wallets[index], credential(index)));
}
```

This registration shortcut is for an **empty registry**, once. **Define the following renewal helper in every console session, even when you skip the registration shortcut to test the UI.** It does not send a transaction until called and preserves the existing ID:

```js
var renew = async (index, overrides = {}) => {
  var old = await registry.identity(wallets[index]);
  if (old.identityId === ethers.ZeroHash) throw new Error('Register this investor first');
  return tx(registry.connect(signers[2]).updateIdentity(wallets[index], {
    identityId: old.identityId, country: Number(old.country),
    kycApproved: old.kycApproved, accredited: old.accredited,
    validUntil: await now() + 30 * 86400, ...overrides
  }));
};
```

To replenish mock money after repeated scenarios:

```js
await tx(usd.mint(wallets[3], U('10000')));
await tx(usd.mint(wallets[4], U('10000')));
await tx(usd.mint(wallets[5], U('10000')));
```

Only A owns MockUSD. Do not treat these mints as investments or proceeds.

### 2.2 Exact time and dates

```js
console.log('Chain time:', new Date((await now()) * 1000).toISOString());
var startTime = await now() + 3600;
var endTime = startTime + 3600;
var localInput = seconds => {
  return new Date(seconds * 1000 + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
};
console.log({ start: localInput(startTime), end: localInput(endTime) });
```

Enter those **Singapore-time (SGT, UTC+08:00)** values in the UI, even if your browser is elsewhere. Minute truncation can change the exact stored seconds, so afterward read `offering.subscriptionStart()` / `subscriptionEnd()` rather than assuming the local variables equal the contract timestamps. Choose dates later than **both current chain time and your computer time** if you have advanced the chain. Fund escrow before opening. Do not jump past the start of an underfunded offering and expect to repair it later.

## 3. Wallet, navigation and transaction behavior

| Done | ID | Step-by-step action | Expected result |
|---|---|---|---|
| [ ] | WAL-01 | Disconnect; visit Marketplace, Compliance and Subscriptions; open an asset/offering URL directly. | Public state loads; writes require connection. No fabricated balances or approvals. |
| [ ] | WAL-02 | Connect A, then B, then D; inspect address, role controls and balances after each switch. | Administration belongs to A; issuance to B; D sees investor actions. Old account's sensitive form/state does not remain actionable. |
| [ ] | WAL-03 | In Compliance, connect D after loading the page disconnected; inspect the checker Sender. Then switch to E. | Sender defaults to the resolved connected account, not the issuer or prior investor. |
| [ ] | WAL-04 | Enter a transfer/credential form; switch accounts or disconnect before submitting. | Account-specific form/results reset; no old-account transaction is sent. |
| [ ] | WAL-05 | Switch wallet to another network without changing the app's local RPC. Try a write. Return to 31337. | Wrong-network notice and disabled/rejected writes; local public data may remain visible. Correct controls recover on return. Do not send a transaction on the other network. |
| [ ] | WAL-06 | Start a valid approval/purchase, then reject it in MetaMask. | Rejected status; no confirmed hash or balance change claimed. You can retry. |
| [ ] | WAL-07 | Start a valid transaction; while awaiting wallet/receipt, try double-clicking its action or another write. | Duplicate submissions blocked; actual hash shown after broadcast; success only after receipt. |
| [ ] | WAL-08 | Approve sale inventory or mUSD; wait for confirmation. | The quantity needed for the next deposit/commit stays entered; approval alone does not transfer tokens/money. |
| [ ] | WAL-09 | Open a second tab, change policy in one, refresh the other before submitting a previously valid action. | Fresh state or preflight prevents an invalid send; contract enforcement remains decisive if the UI was stale. |
| [ ] | WAL-10 | In a separate browser/profile with no compatible wallet, load the app and choose Connect Wallet. | Public pages work; useful missing-wallet feedback; no crash. |

Receipt timeout/pending-network testing is in section 14. Do it after the financial scenarios.

## 4. Platform administration and asset creation

### 4.1 Issuer permissions

1. Connect A; open **Administration**.
2. Enter I's address in **Issuer Ethereum address**; click **Check issuer status**.
3. Click **Authorise Issuer**, sign, wait for confirmation, and switch to I.
4. Create a small legacy asset as I, then switch back to A and revoke I through the confirmation dialog.
5. Switch to I: verify new issuance is unavailable, but its existing asset remains manageable.
6. Re-authorise I if later tests need it. Leave B authorised for the main walkthrough.

| Done | ID | Additional action | Expected result |
|---|---|---|---|
| [ ] | ADM-01 | Complete steps 1–6. | Role changes persist on reload; revoked issuance permission does not erase or freeze existing assets. |
| [ ] | ADM-02 | As A, try blank, malformed, zero address and A's own address. | Invalid inputs rejected; admin cannot authorise itself as issuer. |
| [ ] | ADM-03 | Recheck an already-authorised issuer and an already-revoked issuer. | Inapplicable button disabled; no duplicate state change. |
| [ ] | ADM-04 | As D, visit Administration and Issuer dashboard; attempt console `factory.connect(signers[3]).authorizeIssuer(wallets[7])` through `reject`. | UI role restriction and actual on-chain access rejection. |
| [ ] | ADM-05 | As I, try managing B's sale/policy through console. | Cannot allocate/withdraw B's inventory or modify B's policies. |

### 4.2 Create the fixtures

Use B → **Issuer dashboard** → **Create a tokenised asset**. Create fixtures **when their section begins**, not all at once. Names can be unique; duplicate names/symbols are not forbidden by the contract, so use IDs/addresses to distinguish them.

| Fixture | Mode | Supply | ETH price | Initial cap | Accreditation |
|---|---|---:|---:|---:|---|
| IDTEST | Regulated | 10,000 | 0.001 | 500 | Required |
| RULETEST | Regulated | 10,000 | 0.001 | 500 | Required |
| SALETEST | Regulated | 10,000 | 0.001 | 500 | Required |
| LEGTEST | Legacy whitelist | 10,000 | 0.001 | Not applicable | Not applicable |
| SUB-OVER, SUB-FAIL, SUB-UNDER, SUB-HOLD, SUB-EXP, etc. | Fresh regulated asset for each scenario | 10,000 | 0.001 | 500 | Required |

- [ ] **CREATE-01:** Regulated creation shows token/sale addresses and registry entry. B owns the fixed supply. Compliance shows the registry and policy; no countries are allowed initially. B has policy authority; A has identity administration; B/A are not automatically attestors.
- [ ] **CREATE-02:** Verify new regulated token decimals 0; token/sale/issuer addresses and registry/policy binding agree. `await policy.token()` equals `asset.tokenContract`.
- [ ] **CREATE-03:** Create LEGTEST using **Legacy whitelist**. It appears in the same marketplace/issuer registry but has whitelist controls, not a fabricated identity registry.
- [ ] **CREATE-04:** Submit blank name/symbol, supply `0`, `-1`, `1.5`, `abc`, zero/negative price, and ETH price with more than 18 fractional digits. UI rejects invalid inputs and creates no asset. Empty description is allowed.
- [ ] **CREATE-05:** Reject a creation request in MetaMask; check asset count unchanged. Approve a valid request; exactly one asset appears after confirmation/reload.
- [ ] **CREATE-06:** As D or revoked I, attempt `createRegulatedAsset` directly via console with valid values. It reverts; a hidden UI form is not the only control.

## 5. Identity and trusted attestors

Create **IDTEST** and select it. Do not run the empty-registry shortcut yet. Use the UI throughout this section where possible.

### 5.1 Register and inspect

1. A → **Compliance** → choose IDTEST → **Trusted attestors**. Enter C; click **Trust attestor**.
2. C → Compliance → **Investor wallet** = D. Generate a synthetic ID, country Singapore, KYC checked, accreditation checked, expiry safely in the future. Click **Register identity**.
3. Save that ID. Look up D, then connect D and inspect **Your investor identity**.
4. B → same asset → **Asset policy administration** → allow Singapore.
5. In the checker, use B as sender, D as recipient, amount 100.

Expected: D identity valid; country/accreditation policy passes; transfer allowed. These are mock credentials, not uploaded real documents.

| Done | ID | Ordered test and cleanup | Expected result |
|---|---|---|---|
| [ ] | ID-01 | Complete steps 1–5, then reload the page. | Stored attributes, expiry and current attestor trust match what was submitted. |
| [ ] | ID-02 | As D, inspect controls; as A without attestor role, try creating a credential. | D cannot issue credentials; A can manage trust/revoke but cannot attest merely by being admin. Console attempt confirms access rejection. |
| [ ] | ID-03 | As C, try registering D again. | Rejected as already registered; original record is not overwritten. |
| [ ] | ID-04 | As C, load D using **Load credential for renewal**, retain ID, change accreditation to false and renew; inspect status. Then restore accreditation. | Identity remains valid; recipient policy rejects accreditation when required, then restores eligibility. |
| [ ] | ID-05 | Renew D with KYC unchecked. Inspect identity/checker. Renew with KYC approved again. | KYC-denied identity blocks receipt even when country/accreditation pass. |
| [ ] | ID-06 | A or C revokes D. Read balance and metadata. Renew using C with the same ID. | Revocation does not delete records or seize balances. Renewal clears revocation. |
| [ ] | ID-07 | A removes C's trust. Check D's identity and a proposed transfer. A trusts C again. | Credentials issued by C immediately become invalid, then live/unrevoked credentials become valid again. |
| [ ] | ID-08 | A trusts I. Remove C's trust; I loads and renews D with the same ID. Restore C afterward. | D records I as current attestor and becomes valid; subsequent distrust of C does not invalidate I's re-attestation. |
| [ ] | ID-09 | Trusted C attempts to register C itself. For update self-approval, have I register C first, then C attempts renewal of C. | Both self-attestation paths reject. Admin/attestor status does not override that rule. |
| [ ] | ID-10 | Attempt blank/malformed/zero wallet, zero or malformed ID, past expiry, renewal of unregistered H, and changed ID on D renewal. | Each invalid operation rejects. D's stored ID remains unchanged. Use console to test inputs excluded by UI fields. |
| [ ] | ID-11 | Console tries country `999` and a valid ISO country outside the supported demo list, e.g. `826`. | Both unsupported by this demo. Supported numeric codes are 702, 840, 356; this does not mean other countries are invalid ISO entries. |
| [ ] | ID-12 | Load a short-lived D record, then advance the chain to its exact `validUntil` and refresh. Renew D afterward. | Valid strictly before expiry; invalid **at** expiry. UI expiry display uses stored chain data, not a guessed countdown. |
| [ ] | ID-13 | A tries revoking/renouncing its original default-admin role; an unprivileged wallet tries granting the attestor role. | Locked original admin authority and access control both hold. |

Useful console examples after selecting IDTEST (restore C's trust first if removed):

```js
await renew(3, { validUntil: await now() + 120 });
var expiration = (await registry.identity(wallets[3])).validUntil;
await mineAt(expiration - 1n);
console.log(await registry.identityStatus(wallets[3])); // 0
await mineAt(expiration);
console.log(await registry.identityStatus(wallets[3])); // 4
await renew(3);
await reject(() => registry.renounceRole(ethers.ZeroHash, wallets[0]));
var attestorRole = await registry.TRUSTED_ATTESTOR_ROLE();
await reject(() => registry.connect(signers[7]).grantRole(attestorRole, wallets[7]));
```

Do not treat a JavaScript argument error, RPC failure or stale nonce as a passing contract rejection.

## 6. Regulated transfers and asset policies

Create **RULETEST**, select it, and run section 2.1 to register D/E/F as valid Singapore accredited investors. Start with all 10,000 tokens at B and a 500 cap.

### 6.1 Cap, ordinary transfers and delegated transfers

1. Console: `await tx(token.transfer(wallets[3], 450))` — B sends D 450.
2. UI checker: B → D, 100; expect holding-limit rejection. Repeat with 50; expect allowed.
3. Execute the extra 50 through console; D now has exactly 500.
4. As D, use **My portfolio** to send E 40; D = 460, E = 40.
5. As D, try to send H 1; H is unregistered. No token movement should occur.

- [ ] **RULE-01:** Exact-cap boundary and ordinary transfer behave as above; total supply stays 10,000.
- [ ] **RULE-02:** B → D 41 now rejects (460 + 41 > 500); B → D 40 succeeds. Record balances before/after rejected execution, not just preflight.
- [ ] **RULE-03:** D approves H as spender for 100. H tries delegated transfer D → E 100; it succeeds despite H being unregistered, because holder/recipient compliance and allowance govern the transfer. H is not a recipient or custodian.
- [ ] **RULE-04:** H tries another delegated transfer after consuming the allowance; reject for insufficient allowance. Reapprove and target unregistered H or a recipient already at cap; reject for identity/cap. A reverted compliance transfer must not consume the allowance.
- [ ] **RULE-05:** D self-transfers within its balance; unchanged balance and supply. A self-transfer greater than its balance rejects. Zero-value transfer between eligible endpoints succeeds in console; zero-value transfer involving an invalid identity still rejects. The ordinary UI intentionally accepts only positive quantities.
- [ ] **RULE-06:** Zero sender/recipient in the checker/console rejects. Preflight may use a reason code while ERC20 execution uses a zero-address error. Do not demand identical error names when ERC20 rejects before the compliance hook.
- [ ] **RULE-07:** Supply never increases; neither arbitrary `mint` nor `forcedTransfer` is available on this regulated token. Test actual unsupported selectors in section 13.

Delegated example (choose quantities within the current balances/cap):

```js
await tx(token.connect(signers[3]).approve(wallets[7], 100));
await tx(token.connect(signers[7]).transferFrom(wallets[3], wallets[4], 100));
await reject(() => token.connect(signers[7]).transferFrom(wallets[3], wallets[4], 1));
console.log(await token.allowance(wallets[3], wallets[7])); // 0
await tx(token.connect(signers[3]).transfer(wallets[3], 1));
await tx(token.connect(signers[3]).transfer(wallets[4], 0));
```

### 6.2 Independent policy changes

Perform these in order, restoring each changed policy/credential before the next row. Use small quantities and sufficient balance; otherwise an unrelated balance/cap error can mask the intended check.

| Done | ID | Steps | Expected result |
|---|---|---|---|
| [ ] | RULE-08 | B restricts Singapore; checker B → D 1; execute through console. Restore Singapore. | Valid identity, recipient country failure, no transfer. Existing D balance unchanged. |
| [ ] | RULE-09 | With Singapore temporarily restricted, let D send 1 back to operational B. | Allowed if D identity is valid. Country/accreditation are recipient rules, not outgoing-holder rules. Restore Singapore. |
| [ ] | RULE-10 | C renews E as non-accredited. B → E rejects; B makes accreditation optional and retries; then restores required and C renews E accredited. | Accreditation is independently configurable; changes affect future receipt. |
| [ ] | RULE-11 | C renews E with country India. Receipt rejects; B allows India and it succeeds. Restore E to Singapore and restrict India again. | Registered identity alone is not asset eligibility. |
| [ ] | RULE-12 | B lowers cap below D's current balance. Try 1 incoming, a zero transfer and a self-transfer; then D sends some tokens to B. Restore cap 500. | No confiscation; positive incoming rejected. Zero/self do not increase holdings and can pass; outgoing reduction passes with valid identity. |
| [ ] | RULE-13 | B sets maximum 0. Try positive receipt to a valid investor and deposit into authorised sale custody. Restore cap. | No positive investor receipt; operational inventory can still exceed the investor cap. Zero does not mean unlimited. |
| [ ] | RULE-14 | Revoke D with a nonzero balance; attempt D → B and B → D, including amount 0. Renew D. | Both ordinary endpoints require identity. Balances stay intact while movement is blocked. |
| [ ] | RULE-15 | Remove the attestor currently recorded on D; repeat transfer. Restore trust or re-attest through another trusted attestor. | Current attestor trust affects token execution immediately. |
| [ ] | RULE-16 | Create a separate DLT asset with cap 2,000, no accreditation requirement, and Singapore/India allowed; separately register E there as Indian/non-accredited. | E can receive DLT under its policy while RULETEST can still reject the same wallet. Registry records and policies are per asset, not shared implicitly. |
| [ ] | RULE-17 | Use checker with amount above sender balance, malformed address, negative/fractional amount and huge integer. Edit an input after a previous PASS. | Meaningful rejection/validation; old PASS cleared after edits. A preflight is not a guarantee after policy changes. |

## 7. Direct ETH sales

Create **SALETEST**, select it, and prepare D/E/F using section 2.1. Do not make any other transfers on this fixture.

### 7.1 Successful funding and purchase

1. B → Issuer dashboard → select SALETEST. Its regulated sale is already authorised for custody.
2. Enter **1,000** in **Deposit quantity**. Before approval, deposit must be unavailable.
3. Click **1. Approve Token Spending**, sign and wait. Verify issuer still has 10,000, sale 0, allowance 1,000, and entered quantity remains.
4. Click **2. Deposit Tokens** (the inventory deposit action), sign and wait. B = 9,000; sale = 1,000. Check allowance consumption.
5. D → asset page → buy **100** at 0.001 ETH each.
6. Verify D = 100, sale = 900, B = 9,000, and sale unclaimed proceeds = **0.1 ETH**. Token supply = 10,000. D's ETH spent includes gas in addition to 0.1.

- [ ] **SALE-01:** Complete steps 1–6; check marketplace, asset page, issuer inventory and portfolio agree after refresh.
- [ ] **SALE-02:** D tries buying 401 more; cap would be 501. Reject atomically: D stays 100, sale 900, unclaimed proceeds 0.1 ETH.
- [ ] **SALE-03:** H attempts to buy; identity invalid. Temporarily make E non-accredited, expired or restricted-country and try purchases with sufficient inventory. Each rejects; restore E before moving on.
- [ ] **SALE-04:** Test quantity 0, negative, fractional, non-numeric, above inventory, and above wallet ETH budget. UI validation or contract rejection; never a false success.
- [ ] **SALE-05:** Console sends incorrect payment for one token: too little, then too much. Both revert; no partial sale or retained payment.
- [ ] **SALE-06:** D/H attempts `allocate`, `withdrawProceeds`, `closeSale`, `recoverUnsoldTokens`, `sweepExcessETH`. Each actual contract call rejects as non-issuer.
- [ ] **SALE-07:** As B, try recovering unsold tokens before closing: reject. Cancel the UI close confirmation once; verify sale remains open.
- [ ] **SALE-08:** B withdraws proceeds through UI and confirms. Unclaimed proceeds = 0; sale ETH balance = 0 absent donations; issuer receives 0.1 ETH less its withdrawal gas. A second withdrawal rejects/disabled.
- [ ] **SALE-09:** B permanently closes the sale. D cannot buy and B cannot allocate additional inventory. Closing does not burn existing balances or disable wallet transfers/subscriptions.
- [ ] **SALE-10:** B recovers 900 unsold tokens. B = 9,900, D = 100, sale = 0, supply = 10,000. Second recovery rejects/disabled. There is no reopen action.

Before closing, incorrect-payment examples:

```js
await reject(() => sale.connect(signers[3]).buyTokens(1, { value: ETHER('0.0009') }));
await reject(() => sale.connect(signers[3]).buyTokens(1, { value: ETHER('0.0011') }));
```

### 7.2 Forced ETH is not purchase proceeds — console-assisted

Use another fresh funded sale with a legitimate purchase leaving **0.1 ETH owed**. The test-only harness transfers ETH even though the sale has no ordinary receive function.

```js
var forceArtifact = artifact('ForceSendHarness');
var force = await new ethers.ContractFactory(forceArtifact.abi, forceArtifact.bytecode, signers[7])
  .deploy(asset.saleContract, { value: ETHER('0.05') });
await force.waitForDeployment();
console.log(ethers.formatEther(await rpc.getBalance(asset.saleContract))); // 0.15
console.log(ethers.formatEther(await sale.unclaimedProceeds())); // 0.1
```

- [ ] **SALE-11:** UI shows **Recover excess ETH**. B sweeps exactly 0.05 ETH; the legitimate 0.1 remains withdrawable. Sweep again rejects until more excess exists. No fake Purchase event is created by the donation.

## 8. Legacy whitelist, pause and forced transfer

Create **LEGTEST** with legacy mode; select it. These capabilities are **not** implemented on RegulatedAssetToken. Do not report missing regulated pause/recovery buttons as bugs.

1. B → legacy **Investor eligibility**; check D, approve D, then approve E.
2. Approve the **sale contract** separately; legacy sale eligibility is not automatic.
3. Fund 1,000 tokens through approval then deposit; D buys 100.
4. Use the normal portfolio transfer to move D → E 20.

| Done | ID | Steps | Expected result |
|---|---|---|---|
| [ ] | LEG-01 | Complete steps 1–4. | B 9,000; sale 900; D 80; E 20; eligible transfers and direct sales work. |
| [ ] | LEG-02 | Revoke D while D owns 80. Attempt incoming/outgoing/direct purchase. Restore D. | Revocation preserves 80 but blocks movement and purchase. |
| [ ] | LEG-03 | Revoke sale eligibility; try allocation/purchase. Restore it. Revoke B eligibility; try deposit/recovery; restore B. | Both token endpoints are enforced. Existing balances are not automatically lost. |
| [ ] | LEG-04 | D attempts `setWhitelisted`, role grants and `pause` via console. | Non-authorised calls reject. |
| [ ] | LEG-05 | B grants `COMPLIANCE_ROLE` to C. C can approve/revoke investors but cannot pause or force-transfer without token admin authority. | Delegated compliance is distinct from token administrator. Remove C role afterward. |
| [ ] | LEG-06 | B renounces its own compliance role; refresh issuer UI; use **Restore my compliance role**. | B retains original default-admin recovery authority and can restore the compliance role. Attempts to revoke/renounce B's default-admin role reject. |
| [ ] | LEG-07 | Console B pauses token; attempt direct transfer, delegated transfer, sale purchase, inventory deposit and closed-sale recovery on an appropriately prepared fixture. | All ordinary token movements reject while paused. Approval can still succeed; it is not a movement. |
| [ ] | LEG-08 | While paused, revoke D then force-transfer D's 80 to eligible E. | This **legacy-only** trusted administrator operation succeeds; supply unchanged. History must label it Forced transfer, not an ordinary transfer initiated by D. |
| [ ] | LEG-09 | Attempt forced transfer from an eligible holder, from zero, to an ineligible recipient, above source balance, and as non-admin. | Each rejected under the legacy rules. Do not confuse this administrator power with regulated escrow protections. |
| [ ] | LEG-10 | Unpause; restore D and verify normal operation. | No unexpected whitelist or supply changes occurred during pause. |

Relevant calls (adapt balances if you repeated earlier actions):

```js
var complianceRole = await token.COMPLIANCE_ROLE();
await tx(token.grantRole(complianceRole, wallets[2]));
await tx(token.connect(signers[2]).setWhitelisted(wallets[7], true));
await tx(token.revokeRole(complianceRole, wallets[2]));
await tx(token.pause());
await tx(token.setWhitelisted(wallets[3], false));
await tx(token.forcedTransfer(wallets[3], wallets[4], 80));
await tx(token.unpause());
await tx(token.setWhitelisted(wallets[3], true));
```

## 9. Subscription creation, custody and funding

Create a fresh regulated **SUB-OVER** asset, cap 500, and use section 2.1 so **D/E/F are all valid accredited investors for this fixture**. They need mUSD; mint mock money through A if previous tests consumed it.

### 9.1 Create through the UI

1. B → Issuer dashboard → select SUB-OVER → **Create a subscription offering**.
2. Enter **Tokens offered = 1,000**, **Price per token = 2 mUSD**, **Soft cap = 1,200 mUSD**.
3. Choose start/end safely in the future using section 2.2. Hard cap should show **2,000 mUSD**.
4. Create and open the offering. Record its actual address; call `selectOffering` in the console.
5. As B, click **Authorize subscription custody**. This is not an investor whitelist toggle.
6. Enter 1,000 in **Offering inventory deposit**. Approve inventory, confirm, then deposit inventory and confirm.
7. Verify B = 9,000, offering = 1,000, direct sale = 0, deposited inventory = 1,000. The 500 investor cap must not prevent escrow funding.

| Done | ID | Additional action | Expected result |
|---|---|---|---|
| [ ] | SUB-01 | Complete creation/funding above. | Correct asset ID, token, issuer, payment token, immutable dates and hard cap. No extra asset supply minted. |
| [ ] | SUB-02 | On a separate draft, try zero/negative/fractional supply, supply above total asset supply, zero price, >6 mUSD decimals, soft cap 0 or above hard cap, start in past, end at/before start. | Invalid creation rejected; no registered offering appears. Whole-token supply and exact six-decimal currency are distinct. |
| [ ] | SUB-03 | D or a different issuer attempts creating an offering for B's asset; revoke B issuer permission and attempt another creation, then restore B. | Only currently authorised actual issuer may create; existing offerings survive issuer deauthorisation. |
| [ ] | SUB-04 | Before custody authorisation, B approves tokens then attempts deposit through console. | Approval may succeed; actual transfer to unapproved escrow rejects. Authorise custody, then retry successfully. |
| [ ] | SUB-05 | Before allowance, attempt deposit. Approve less than intended amount and retry. | Both fail without changing recorded inventory. After sufficient approval, deposit works. |
| [ ] | SUB-06 | Deposit in two parts, e.g. 400 then 600, on a separate fixture. Try an extra 1 or zero. | Partial funding recorded correctly; total cannot exceed offered supply; zero rejects. |
| [ ] | SUB-07 | Send tokens directly to the offering address instead of `depositOfferingTokens`, on a separate fixture. | Token balance increases but recorded `depositedInventory` does not. Donation does not satisfy funding prerequisite. |
| [ ] | SUB-08 | Before start, attempt commitment/finalisation. After start, attempt deposit. After end, attempt commitment. | Stage restrictions enforced on chain, not just hidden UI controls. |
| [ ] | SUB-09 | Open a separate offering with only 999/1,000 deposited. Try subscribing. | Commits reject. Late funding cannot repair it after start; after end finalise failure and recover actual inventory. |
| [ ] | SUB-10 | Create two offerings for the same asset. Deposit into one, then check remaining B balance before funding the other or a direct sale. | All draw from the same fixed supply; escrow inventory cannot be counted twice. Insufficient issuer balance causes rejection. |

For exact boundaries, use a **separate small offering** and `staticCall` to avoid advancing time while examining a boundary. Set the next block to start−1, mine, check commitment rejection; mine at start, check valid commitment succeeds via static call; mine at end, check commitment rejects and finalisation is eligible. Signer needs valid identity, money, allowance and fully funded escrow for this to test time rather than another precondition.

## 10. Successful oversubscribed offering

Continue SUB-OVER only after it is fully funded. D/E/F must start with zero SUB-OVER tokens, valid credentials and sufficient mUSD. Record each wallet's initial mUSD balance; expected changes below are **deltas**, not assumptions about previous scenarios.

### 10.1 Open, approve and commit

Console:

```js
await mineAt(await offering.subscriptionStart());
```

Refresh the offering. It should show **Subscription Open**.

1. D enters **1,800 mUSD**. Approve mUSD, confirm; verify balance/commitment unchanged by approval. Then **Commit stablecoins**, confirm.
2. E commits **1,400 mUSD** using the same approval/commit flow.
3. F commits **800 mUSD**.
4. Verify total demand **4,000**, hard cap **2,000**, three distinct subscribers, demand **200%**. Extra demand is accepted; the hard cap limits accepted proceeds, not gross commitments.

- [ ] **OVER-01:** Complete the above; offering mUSD balance = 4,000 and `paymentLiabilities()` = 4,000 before settlement.
- [ ] **OVER-02:** Before an investor's first valid commit, test no allowance, insufficient allowance, non-price-multiple `3 mUSD`, zero, negative, >6 fractional digits and above mUSD balance. No partial commitment/payment recorded.
- [ ] **OVER-03:** On a separate identical fixture, D commits 1,000 then 800. D's total = 1,800; `subscriberCount` remains one for D. Allocation equals a single 1,800 commitment.
- [ ] **OVER-04:** H/expired/revoked/non-accredited/restricted investor attempts commitment on a fixture whose policy excludes them. UI and actual contract reject. Money stays with investor.
- [ ] **OVER-05:** Before closing/finalisation, attempt settle/refund/claim/issuer proceeds withdrawal. No early payout or allocation can be obtained.

### 10.2 Finalise and settle

```js
await mineAt(await offering.subscriptionEnd());
```

1. D or H (not necessarily B) clicks **Finalise offering**.
2. Expect Successful; a second finalisation rejects.
3. Before anyone settles, B's recognised proceeds are **zero**, even though 4,000 mUSD sits in escrow.
4. D clicks **Settle subscription**. Check allocation 450, accepted 900, refund 900. Settlement alone moves no funds/tokens.
5. E and F settle. Verify the table below.

| Investor | Committed mUSD | Allocation | Accepted mUSD | Refund mUSD |
|---|---:|---:|---:|---:|
| D | 1,800 | 450 | 900 | 900 |
| E | 1,400 | 350 | 700 | 700 |
| F | 800 | 200 | 400 | 400 |
| Total | 4,000 | 1,000 | 2,000 | 2,000 |

- [ ] **OVER-06:** Each settled amount matches exactly. Before all settle, `guaranteedAcceptedFunding` is a conservative bound (**1,996 mUSD** here), not the final proceeds total. Final recognised proceeds become **2,000 mUSD**.
- [ ] **OVER-07:** Repeat settle as D; reject. H tries `settleSubscription` without a commitment; reject. H may call `settleFor(E)` before E settles; it must only record E's entitlement, never redirect payment to H.
- [ ] **OVER-08:** B withdraws recognised proceeds after D settles but before E/F settle: only **900 mUSD**, not 4,000. After E/F settle, only another **1,100** becomes withdrawable. This path and waiting to withdraw 2,000 at once must have identical final results.

### 10.3 Claim, refund and reserves

1. After finalisation but **before any claims**, B attempts inventory recovery. It must reject: all 1,000 tokens are reserved.
2. D claims **before** refund; E refunds **before** claiming; F performs both in either order.
3. Verify D/E/F token balances = **450/350/200** and net mUSD decreases = **900/700/400** relative to their initial balances.
4. Verify B received total proceeds **2,000 mUSD**, offering token/mUSD balances = 0, liabilities = 0, reserved = 0. Token supply remains 10,000; B retains 9,000 of that asset.

- [ ] **OVER-09:** Repeated claim/refund/proceeds withdrawal rejects or is disabled. No double payment.
- [ ] **OVER-10:** H cannot claim/refund someone else's entitlement, and cannot withdraw issuer proceeds or recover inventory.
- [ ] **OVER-11:** Repeat with investors settling/claiming in reverse order on a fresh identical fixture. Final entitlements and money totals are identical.

Accounting inspection, usable after each financial action:

```js
console.log({
  gross: String(await offering.totalCommitments()),
  liabilities: String(await offering.paymentLiabilities()),
  refundsPaid: String(await offering.refundsPaid()),
  proceedsPaid: String(await offering.proceedsWithdrawn()),
  mUSDBalance: String(await usd.balanceOf(offeringAddress)),
  reserved: String(await offering.reservedTokens()),
  tokenBalance: String(await token.balanceOf(offeringAddress)),
  recoverable: String(await offering.recoverableTokens())
});
```

Always check: gross = liabilities + refunds paid + proceeds paid; mUSD balance ≥ liabilities; token balance ≥ reserved; allocated tokens ≤ offered supply; accepted proceeds ≤ hard cap. Donations can make a balance greater than its liabilities, so do not require equality after donation tests.

## 11. Failed, undersubscribed and rounding cases

**Create a fresh regulated asset and offering for each row.** Prepare eligible D/E/F, authorise escrow, fully fund before start unless the row says otherwise, approve/commit during the window, then finalise after end. This isolation avoids previously claimed balances triggering caps. Prices/soft caps/commitments below are in human-readable mUSD, not raw micro-units.

| Done | ID | Offering and ordered actions | Exact expected result |
|---|---|---|---|
| [ ] | MATH-01 | SUB-FAIL: supply 1,000, price 2, soft cap 1,200; D commits 700. Close/finalise, settle, refund, recover inventory. | Failed; D allocation 0, refund 700; issuer proceeds 0; issuer recovers all 1,000 tokens; no token claim. |
| [ ] | MATH-02 | Same offering but no commitments. Finalise after end; B recovers inventory. | Failed; no refunds/proceeds due; recover 1,000; no division-by-zero crash. |
| [ ] | MATH-03 | SUB-UNDER: supply 1,000, price 2, soft cap 1,200; D=600, E=800 commitments. | Successful; D gets 300, E 400, refunds 0; proceeds 1,400; exactly 300 unsold tokens recoverable, while 700 remain reserved before claims. |
| [ ] | MATH-04 | Same supply/price/soft cap; D=600, E=600. | At soft-cap boundary: successful; 300 tokens each, no refunds; proceeds 1,200; unsold 400. |
| [ ] | MATH-05 | Same supply/price; D=1,000, E=1,000. | Exactly hard cap: 500 tokens each, no refunds, proceeds 2,000. Claims each fit cap exactly. |
| [ ] | MATH-06 | Supply 7, price 2, soft cap 10; D/E/F each commit 6. | Gross 18; successful conservative bound 10; each gets 2 tokens, accepted 4/refund 2; proceeds total 12; one token rounding dust. Dust unlocks after **all settle**, not only after claims. |
| [ ] | MATH-07 | Same 7-token offering, but soft cap 12. | **Fails conservatively**: bound 10 < soft cap 12, although actual rounded proceeds could be 12. Each refund 6; no allocations. This documented design trade-off is not a test failure. |
| [ ] | MATH-08 | Supply 3, price 1, soft cap 2; D commits 1, E commits 9. | Successful bound 2; D allocation 0/refund 1; E allocation 2/accepted 2/refund 7; D cannot claim; one dust token recoverable after both settle. |
| [ ] | MATH-09 | Supply 1, price 1, soft cap 1; D and E each commit 1. | More subscribers than tokens; guarantee 0; fails and fully refunds both. No arbitrary first-come winner. |
| [ ] | MATH-10 | Supply 10, price 0.000001, soft cap 0.000005; D and E each commit 0.000003. | Six-decimal precision works: successful; 3 whole tokens each; accepted total 0.000006, no refunds, 4 unsold. No floating-point rounding in accounting. |

For MATH-06, specifically settle only D/E, query reserve/recoverable, then settle F and query again. Before all settle, the conservative reserve protects potential outstanding allocations; only afterward does the one-token dust become safely recoverable. Issuer recovery must never reduce reserves for unclaimed tokens.

- [ ] **MATH-11:** Donate extra mUSD to a settled successful offering using `usd.transfer`. `totalCommitments`, allocations and recognised proceeds do not increase. There is no arbitrary mUSD donation-sweep feature; unsolicited surplus may remain trapped. Do not count it as issuer revenue.
- [ ] **MATH-12:** Donate extra asset tokens after finalisation from an eligible/operational sender. Only balance above reserved tokens may be recovered; outstanding entitlements remain covered.

## 12. Compliance changes during subscriptions

For each independent scenario use a **fresh** regulated asset/offering with supply 1,000, price 2, soft cap 1,200. D/E each commit 2,000. After closing, each final allocation is 500 and refund is 1,000. Settle both before changing credentials/policy. D/E initially have zero tokens and valid credentials.

| Done | ID | Steps and restoration | Expected result |
|---|---|---|---|
| [ ] | LIFE-01 | Revoke D after settlement. Attempt claim; withdraw D refund; try issuer recovery; renew D; claim. | Claim blocked, refund 1,000 succeeds, 500-token D entitlement remains reserved, recovery cannot seize it; renewal allows exactly one 500-token claim. |
| [ ] | LIFE-02 | Renew D with short future expiry **after settlement**; mine at expiry. Attempt claim/refund; renew and retry claim. | Same protection under expiry. Other investors' credentials remain live if their expiry is later. |
| [ ] | LIFE-03 | Remove D's recorded attestor; attempt claim and refund. Restore trust or re-attest through I. | Claim blocked but refund accessible; allocation unchanged; restored eligibility permits claim. |
| [ ] | LIFE-04 | Before claim, B restricts Singapore. Attempt claim/refund. Restore country. | Country change never recalculates allocation or refund. Country restoration permits claim. |
| [ ] | LIFE-05 | C renews D without accreditation. Claim fails; refund works. Restore accreditation or make it optional, then claim. | Entitlement preserved regardless of later accreditation policy. |
| [ ] | LIFE-06 | SUB-HOLD: after settlement, B sends D 200 tokens outside the offering. D tries claiming 500. Withdraw refund; D sends 200 back to B; claim. | 700 would exceed cap 500, so initial claim fails without partial delivery. Full 500 remain owed; enough capacity restores full claim. |
| [ ] | LIFE-07 | Alternative to LIFE-06: instead of D sending 200 out, B increases cap to 700 and D claims. | Full allocation delivered; no silent reduction to 300 and no confiscation. Use a fresh fixture for this alternative. |
| [ ] | LIFE-08 | Lower cap to 400 while a 500-token allocation is outstanding. Attempt claim/refund; restore cap 500. | Policy change blocks delivery but not refund/accounting. Restore and claim. |
| [ ] | LIFE-09 | Complete a failed-offering scenario, then revoke the investor before settlement/refund. | Failed-offering full refund remains usable; no asset identity requirement added to MockUSD. |
| [ ] | LIFE-10 | Use a fresh **legacy** subscription asset with investors and escrow whitelisted; settle an oversubscribed offering; pause legacy token. Refund then attempt claim; unpause and retry. | Refund succeeds while token claim is paused. Regulated `paused()` is always false; no regulated pause button is expected. |
| [ ] | LIFE-11 | Leave D's successful allocation unclaimed; settle every investor; recover only actual unsold/dust tokens, then wait/advance within other credential validity. | D entitlement has no arbitrary claim deadline. Reserved inventory cannot be withdrawn simply because D is inactive. |

**Important:** an invalid ordinary sender cannot move existing holdings out to solve a cap problem until its identity is restored. A still-verified investor whose recipient country/accreditation policy changed can still send to a valid recipient. Do not mix up those two cases.

## 13. Adversarial permissions and immutable configuration

Use fresh fixtures or restore each mutation. UI hiding is not sufficient: invoke the contract with the wrong signer and confirm the intended revert. `token`, `registry`, `policy`, `sale`, `offering` must reference the correct selected fixture.

| Done | ID | Actual contract attempt | Expected result |
|---|---|---|---|
| [ ] | SEC-01 | H registers/updates/revokes D's identity or grants itself the trusted role. | Access denied; record/roles unchanged. |
| [ ] | SEC-02 | A or D changes B's policy (`setCountryAllowed`, cap, accreditation). | Only the immutable issuer policy administrator may change it; platform identity administration does not imply policy authority. |
| [ ] | SEC-03 | Rebind `policy.bindToken` to this or another token. | Reject; binder-only and one-time binding cannot be replaced by issuer/investor. |
| [ ] | SEC-04 | Call `factory.setSubscriptionFactory` again, even with the existing address. | Reject; one-time choice is locked. Initial wrong-factory linkage is also covered by automated tests. |
| [ ] | SEC-05 | D/H calls `token.registerSubscriptionEscrow`; B passes H's EOA or another asset's registered offering. | Cannot self-grant exemptions; only issuer and matching platform custody accepted. |
| [ ] | SEC-06 | Deploy a standalone lookalike offering with the correct token/issuer but outside `sf`, then try to register it. | Registry membership required; matching getters alone do not grant exemption. See executable example below. |
| [ ] | SEC-07 | B tries replacing the registered sale, removing an operational account or adding an arbitrary EOA through invented selectors. | No generic exemption/removal API; exact sale binding cannot be replaced. Outstanding escrow is not administratively declassified. |
| [ ] | SEC-08 | Send `mint`, `burn`, `forcedTransfer`, `setIdentityRegistry`, `setCompliance` selectors to regulated token. | No such privilege path. Supply/module references unchanged. Do not apply this expectation to legacy `forcedTransfer`. |
| [ ] | SEC-09 | H mints MockUSD; D tries withdrawing issuer proceeds; H tries another investor's refund/claim. | Access/caller-entitlement checks reject; payout cannot be redirected. |
| [ ] | SEC-10 | Directly approve a malicious/unauthorised spender, then attempt an otherwise noncompliant `transferFrom`. | ERC20 allowance cannot override identity, country, accreditation or cap checks. |
| [ ] | SEC-11 | Inspect old deployment/asset addresses after selecting a new frontend registry. | Old immutable contracts were not upgraded in place; the UI configuration chooses what registry it displays. No claim of migration. |

Examples:

```js
await reject(() => policy.connect(signers[3]).setMaxWalletHolding(999999));
await reject(() => policy.bindToken(asset.tokenContract));
await reject(() => factory.setSubscriptionFactory(cfg.SubscriptionFactory));
await reject(() => token.registerSubscriptionEscrow(wallets[7]));
await reject(() => usd.connect(signers[7]).mint(wallets[7], U('1000')));
var fakeStart = await now() + 3600;
var offArtifact = artifact('SubscriptionOffering');
var fakeOffering = await new ethers.ContractFactory(offArtifact.abi, offArtifact.bytecode, signers[1]).deploy({
  assetToken: asset.tokenContract, paymentToken: cfg.MockUSD, issuer: wallets[1],
  supply: 100, price: U('2'), softCap: U('100'), start: fakeStart, end: fakeStart + 3600
});
await fakeOffering.waitForDeployment();
var fakeAddress = await fakeOffering.getAddress();
await reject(() => token.registerSubscriptionEscrow(fakeAddress));
var forbidden = new ethers.Contract(asset.tokenContract, [
  'function mint(address,uint256)',
  'function forcedTransfer(address,address,uint256)',
  'function setCompliance(address)',
  'function setOperationalAccount(address,bool)'
], signers[1]);
await reject(() => forbidden.mint(wallets[7], 100));
await reject(() => forbidden.forcedTransfer(wallets[3], wallets[7], 1));
await reject(() => forbidden.setCompliance(wallets[7]));
await reject(() => forbidden.setOperationalAccount(wallets[7], true));
```

Permanent custody and immutable references reduce some attack paths; they do not remove trust in the platform administrator's initial factory choice, honest attestation, or the issuer's policy decisions. Multi-wallet splitting is not prevented by a per-wallet cap. Do not mark those documented limitations as implemented security guarantees.

## 14. History, presentation and resilience

### 14.1 Data and layout

| Done | ID | Steps | Expected result |
|---|---|---|---|
| [ ] | UI-01 | After each major transaction, reload Marketplace, asset details, issuer dashboard, portfolio and offering. | Actual confirmed balances and state agree; no reset to placeholder data. |
| [ ] | UI-02 | Review direct-sale history after purchases, deposits, close, recovery and forced ETH sweep; review legacy forced transfer. | Each operation accurately labelled; purchase's underlying transfer not misleadingly double-counted; forced transfer attributed as administrative. |
| [ ] | UI-03 | Review subscription history after approval, commitment, finalisation, settlement, refund, claim, proceeds and recovery. | Approval is not investment; currency is mUSD, not ETH; refund and claim are distinct. |
| [ ] | UI-04 | Inspect Compliance after a credential/policy change and ordinary asset history. | Compliance status changes correctly. Do not expect a complete credential/policy event-history dashboard: the current UI primarily shows current state, while events remain on chain. |
| [ ] | UI-05 | Click/load older history and offering pages when enough data exists. For a pagination stress run, create >24 small offerings. | Previous/next pages work; no duplicate or missing rows at boundaries. Mark blocked if you did not create sufficient data. |
| [ ] | UI-06 | Check all synthetic identity fields and timestamps against console reads. | No fabricated attributes; supported country labels correct; operational accounts explicitly identified; no real PII requested. |
| [ ] | UI-07 | Resize to approximately 375px, 768px and desktop width. Navigate long-address and validation-heavy pages. | No clipped critical controls, unreadable text, unintended horizontal overflow or hidden transaction status. |
| [ ] | UI-08 | Use keyboard navigation for wallet controls, forms, selects and confirmation dialogs. Check focus and labels. | Actions reachable; fields labelled; focus visible; success/error messages understandable without color alone. |
| [ ] | UI-09 | Open invalid asset ID, unknown offering address and nonexistent route. | Useful error/empty state, not a crash or accidental interaction with an arbitrary contract. |
| [ ] | UI-10 | Open the app after disabling network access to RPC temporarily, then restore it and use Retry. | Connection error and recovery; old data not silently presented as a newly verified success. |

### 14.2 Pending receipts — do last, local chain only

1. Ensure there is a valid small transfer/approval to make on the currently selected fixture.
2. Console: disable interval mining with `await rpc.send('evm_setIntervalMining', [0])`, then `await rpc.send('evm_setAutomine', [false])`. Both are needed to keep the transaction pending.
3. Submit the valid transaction through MetaMask. Do not use the `tx` helper for this submission because it waits for a receipt.
4. Check submitted/pending hash and disabled duplicate actions. Wait long enough to reach the app's uncertain-receipt state if testing that branch; do not assume a particular timeout duration.
5. Restore mining and mine a block:

```js
await rpc.send('evm_setAutomine', [true]);
await rpc.send('evm_mine', []);
await rpc.send('evm_setIntervalMining', [2000]);
```

6. Use **Check confirmation** if shown. Inspect actual receipt and balances.

- [ ] **RES-01:** No success before an actual receipt; timeout is not falsely reported as a definite revert; retry does not duplicate the write while confirmation is uncertain.
- [ ] **RES-02:** After mining resumes, confirmation and balances reconcile with the actual chain result.

Always restore automining even if you abort this test. Never leave a pending transaction unexamined and simply press the action again.

### 14.3 Deployment reset / stale configuration — last test

1. Record evidence and stop the frontend if necessary. Stop the local Hardhat node, then start a fresh one.
2. **Before redeploying**, open the app using the stale addresses configuration; connect a wallet and attempt to inspect/write.
3. Expect missing-deployment/earlier-chain-session/fingerprint feedback, not a transaction against an unrelated empty deployment.
4. Run `npm run deploy:compliance:local`, restart Vite and reload. Reinitialize section 2's console variables.
5. If your wallet cached nonces from the old chain, clear its **local test account activity/nonce state** using the wallet's controls, or use a fresh testing profile. Do not submit replacement transactions on a real network.

- [ ] **RES-03:** Old chain state is not assumed valid solely because chain ID is still 31337. Correct fresh config restores normal reads/writes.
- [ ] **RES-04:** A separately configured wallet RPC pointing to a different local chain with the same chain ID is rejected for regulated/subscription writes when code/block fingerprints differ. This needs a second local node; mark blocked if you did not set one up.

## 15. Automated backstop and sign-off

Some cases are better exercised by existing adversarial harnesses than by pretending they are manual browser features: callback reentrancy, dishonest/fee-on-transfer payment tokens, unusual return values, arithmetic extremes, constructor-invalid combinations, forced reserve loss, provider log-range splitting and randomized operation sequences.

Run these from the root after completing your rehearsal; the root integration command starts an isolated local node with its own fixtures:

```bash
npm test
npm --prefix frontend test
npm run test:integration
npm --prefix frontend run build
npx tsc --noEmit
npm run demo:subscriptions
npm run demo:compliance
```

The two `demo:*` commands above use isolated ephemeral chains; they do not populate your currently open UI. `npm run test:integration` starts and stops an isolated node, so its time travel does not advance the demo on port 8545.

Latest recorded enhancement baseline for comparison: **229 contract tests, 140 frontend tests, 3 integration tests**, successful build/typechecks. Re-run and record your actual results; do not copy these counts as evidence of a new run. [Detailed prior evidence](docs/compliance-test-results.md), [subscription mathematics](docs/subscription-allocation-mathematics.md), [security review](docs/compliance-threat-model.md), and [full-standard comparison](docs/erc3643-comparison.md) explain the intended behavior and limitations.

### Priority rehearsal if time is limited

Complete SET-01/02; WAL-02/05/06/08; ADM-01/04; CREATE-01/03; ID-01/03/06/07/12; RULE-01/04/08/12/16; SALE-01/02/08/09/10; LEG-01/02/07/08; SUB-01/04/05/09; the full section 10; MATH-01/03/06/07; LIFE-01/02/06/10; SEC-01/05/08; UI-02/03/07; and RES-01/02. The rest should still be completed before claiming full manual acceptance.

### Final record

| Category | PASS / FAIL / BLOCKED | Evidence / remaining issue |
|---|---|---|
| Local deployment and roles | | |
| Wallet/network and transaction lifecycle | | |
| Legacy issuance, whitelist and emergency controls | | |
| Regulated identities and per-asset policies | | |
| Direct sales and ETH accounting | | |
| Subscription success/failure/rounding | | |
| Refund independence and claim reserves | | |
| Actual contract permission failures | | |
| History, accessibility and responsive layout | | |
| RPC failures, pending receipt and chain reset | | |
| Automated regressions/build/typechecks | | |

Record tester, date, branch/commit plus whether the tree was dirty, browser/wallet versions, network, active deployment addresses, failed case IDs and reproduction steps. Report an unexpected result with its actual hash/error and state before/after. A hidden button, a passing preflight, or an estimate rejection alone does not prove every corresponding contract invariant.
