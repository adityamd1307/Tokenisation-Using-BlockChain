# Phase 4 — frontend and MetaMask integration

Date: 28 October 2026, Asia/Singapore. Authority: the user's [preserved Phase 4 request](spec/phase4-requirements.md). This report describes implemented code and observed validation, with manual browser checks explicitly outstanding. No commits or Phase 5 deployments were performed.

## Scope and baseline

The starting frontend contained a navigation-only `App.tsx`, three unmounted dashboard placeholders, no wallet integration, no router, and an empty factory address. `npm run build --prefix frontend` failed with TS5083 because `frontend/tsconfig.json` did not exist. The baseline is preserved in [baseline-build.log](evidence/phase4/baseline-build.log). README still described Phase 2 and incorrectly called completed factory/sale tests placeholders.

Inspected the README, SETUP, historical specification, Phase 2/3 requirements and implementation reports, all three production contracts, generated artifacts, deployment/demo scripts, package configurations, and contract test suites. No `docs/specification.md`, `docs/architecture.md` or applicable `AGENTS.md` existed. `CLAUDE.md` audit guidance was read; the current explicit instruction against commits takes precedence over its commit-based workflow. Targeted before/after logs preserve new defect evidence without commits. The historical D5 pause/freeze/forced-transfer discussion does not authorise new Solidity features in this phase.

Retained React 18.3.1, Vite 6.4.5, ethers 6.17.0, frontend TypeScript 6.0.3, Hardhat 3.21.0, root TypeScript 7.0.2, OpenZeppelin 5.6.1 and Solidity 0.8.24. Node was 22.18.0. Added React Router 7.18.5 and Vitest 4.1.12 with jsdom and React Testing Library. Initially selected older router/test-runner majors were replaced after npm audit reported advisories; the final report has zero vulnerabilities. The lockfile is included and a clean `npm ci --prefix frontend --ignore-scripts` was exercised.

## Architecture and routing

| Layer | Files / responsibility |
|---|---|
| Presentation | `pages/` supplies Marketplace, AssetPage, AdminDashboard, IssuerDashboard and InvestorPortfolio. `components/` supplies layout/navigation, cards, creation/compliance/inventory forms, wallet controls, transaction status/history, dialogs and reusable feedback. |
| Blockchain services | `services/blockchain.ts` centralises registry reads, roles, account state, exact ABI writes and preflight checks. `wallet.ts` implements EIP-1193 requests and network switching. `transactions.ts` verifies receipts. `history.ts` maps bounded event queries into activity records. No UI component directly sends raw contract writes. |
| State | `WalletContext` tracks selected provider, account, chain, session generation, platform roles and ETH balance. `DataContext` invalidates on-chain reads after confirmation. `TransactionContext` handles one active transaction per wallet session. `useAsync` discards stale reads by key and cancellation flag. |
| Configuration | Compiled ABIs in `config/abi/`, deployment identity in `addresses.json`, shared `contracts.ts` and `networks.ts`. `VITE_RPC_URL` can override the public RPC; never put secrets in Vite variables. |

Routes are `/` (public marketplace), `/assets/:id`, `/admin`, `/issuer`, `/portfolio`. The old `/investor` path redirects to `/portfolio`; unknown paths show a useful fallback. BrowserRouter requires an SPA fallback on any future static host; Vite serves these paths in development and preview.

The dashboard uses neutral backgrounds, teal accents, readable panels, responsive cards/forms, horizontal table scrolling and breakpoints at 1250, 950, 700 and 500px. Dialogs use native `<dialog>` with focus on Cancel, Escape handling and modal focus behavior. Inputs are labelled, errors use alerts, status messages use live status regions, copy controls expose full addresses, and reduced-motion preferences are respected. Fonts use a Google Fonts stylesheet with system fallbacks. CSS responsiveness is implemented; visual/accessibility verification in a real browser remains outstanding.

## Wallet and deployment handling

Public browsing uses a configured ethers `JsonRpcProvider`, independent of wallet connection. The wallet uses ethers v6 `BrowserProvider` only for signing. EIP-6963 announcements support multiple providers; legacy `window.ethereum.providers` and `window.ethereum` are fallbacks. Provider announcements render as text, not untrusted icons/HTML. Connecting is an explicit action using `eth_requestAccounts`; no transaction or wallet prompt runs on mount. Account grants are not persisted in browser storage.

Listeners for `accountsChanged`, `chainChanged` and `disconnect` invalidate account, role, ETH balance, eligibility, holdings, issuer forms and transaction UI immediately. Session counters prevent old asynchronous responses from populating a new wallet's state. Listener cleanup runs on provider changes/unmount. The Disconnect control disconnects the application session; it does not claim to revoke the extension's site permission.

The wrong-network banner shows both current and required chain IDs and exposes Switch Network. It requests `wallet_switchEthereumChain`, and only on unknown-chain error 4902 uses `wallet_addEthereumChain` followed by another switch. Rejection is shown without crashing. Every write rechecks `eth_accounts` and `eth_chainId` before obtaining the signer. Contracts remain authoritative if state changes between preflight and mining.

The exact local chain is 31337 (previous Hardhat default, now explicit for both simulated and localhost configurations). `scripts/deploy.ts` generates factory address, chain ID, deployment block and block hash, and runtime bytecode hash. Reads/writes check the public RPC chain, deployed code, hash and deployment block to detect missing or stale configurations, including reuse of an address after reset. No guessed fallback factory address is used.

`scripts/syncFrontend.mjs` copies only ABI arrays from the three compiled Hardhat artifacts. Deployment and frontend `predev`/`prebuild`/`pretest` run this sync. Run root `npm run compile` first on a fresh checkout, or `npm run frontend:sync` when changing contracts. Generated ABIs are tracked for review but never manually edited. No Solidity changes were necessary.

## Contract integration map

| Feature | Actual calls | Actual events |
|---|---|---|
| Platform roles and issuer lookup | Factory `admin()`, `authorisedIssuers(address)` | — |
| Authorise / revoke issuer | Factory `authorizeIssuer(address)`, `revokeIssuer(address)` | `IssuerAuthorised`, `IssuerRevoked` emitted by contracts; UI refreshes address lookup after receipt |
| Registry / creation | Factory `getAssetCount()`, `getAsset(id)`, `createAsset(name,symbol,description,assetType,totalSupply,unitPriceWei)` | `AssetCreated` is decoded from the successful creation receipt and queried in history |
| Metadata and account holdings | Registry metadata; token `balanceOf`, `isWhitelisted`, `allowance` | `Transfer` |
| Compliance | Token `COMPLIANCE_ROLE`, `DEFAULT_ADMIN_ROLE`, `hasRole`, `setWhitelisted` | `WhitelistUpdated` |
| Restore issuer compliance authority | Token `grantRole(COMPLIANCE_ROLE, connectedAccount)` when the actual token admin role is present | Standard AccessControl `RoleGranted` emitted |
| Whitelist and fund sale | Token `setWhitelisted(sale,true)`, `approve(sale,exactQuantity)`; sale `allocate(quantity)` | `WhitelistUpdated`, `Approval`, `Allocated`, `Transfer` |
| Sale state | `pricePerToken`, `availableTokens`, `saleClosed`, `unclaimedProceeds`; RPC `getBalance(sale)` | — |
| Purchase | Sale `buyTokens(quantity,{value: quantity * pricePerToken})` | `Purchased`, `Transfer` |
| Transfer | Token `transfer(recipient,quantity)` | `Transfer` |
| Withdraw / close / recover | Sale `withdrawProceeds`, `closeSale`, `recoverUnsoldTokens` | `ProceedsWithdrawn`, `SaleClosed`, `UnsoldTokensRecovered` |
| Forced ETH excess | Sale `sweepExcessETH`, offered only when ETH balance exceeds accounted proceeds | `ExcessETHSwept` |

The factory does **not** expose an AccessControl admin role or issuer enumeration. It uses immutable `admin` and a mapping. Asset IDs start at zero. Tokens have zero decimals; deposits use `allocate`, not the conceptual `depositTokens`. Recovery uses `recoverUnsoldTokens`, not `withdrawUnsoldTokens`. Prices are immutable. Descriptions have no Solidity restriction, so blank descriptions are allowed and explicitly labelled. No pause/freeze, market price, USD value, yield, valuation, KYC, custody or legal ownership capability is invented.

## User workflows

1. **Browse and connect:** browse actual assets without a wallet; search names/symbols and filter category/status. Connect, copy the full address, inspect network/roles and explicitly switch when necessary.
2. **Administrator:** enter a nonzero Ethereum address, check status, authorise. Revocation requires confirmation explaining that existing assets remain operational. The admin cannot authorise itself under the existing contract policy.
3. **Create:** an authorised issuer enters name, symbol, optional description, category, positive whole supply and a positive ETH price (at most 18 decimals). Creation success requires a status-1 receipt; decode `AssetCreated`, read the registry and show ID, token and sale addresses.
4. **Compliance:** select an owned asset and check an address. Approve or revoke with the asset-specific whitelist. Revocation confirmation explains that existing balances remain but sending and receiving stop. Sale eligibility and issuer eligibility are separately shown. If the issuer lost COMPLIANCE_ROLE, the UI checks actual token admin authority before offering role restoration.
5. **Fund:** approve the sale's eligibility; enter quantity; approve precisely that allowance; await receipt; explicitly submit a separate deposit; refresh balance, allowance and inventory. Failed/rejected approval never triggers deposit. Quantity remains entered across allowance refresh (AUD-009).
6. **Buy:** check both buyer and sale eligibility, open status, whole quantity, inventory and payment. Display exact ETH and sale address. Preflight re-reads state; `BigInt` multiplies whole tokens by wei. `parseEther`/`formatEther` are used only for exact conversion. Bounds reject uint256 overflow. Fees are left for wallet estimation.
7. **Portfolio and transfer:** enumerate the registered tokens and read actual balances, including revoked holders. Show only positive holdings but query event history across all registered assets, including assets whose balance is now zero. Check sender and recipient eligibility and balance, display the token address and transfer whole units. No optimistic balance is treated as confirmed.
8. **Proceeds:** distinguish sale ETH balance from `unclaimedProceeds`. Confirm withdrawal amount and issuer recipient. Zero proceeds disables withdrawal; forced ETH excess is separately recoverable.
9. **Close and recover:** confirm permanent closure, disable deposits and purchases after refreshed on-chain state, then recover all unsold inventory. Both issuer and sale must be eligible; the UI offers permitted eligibility restoration, never a compliance bypass.

Factory revocation prevents creation only. Existing issuer assets remain manageable according to token roles and immutable sale issuer. A delegated compliance-only account that is not the registry issuer is not given a separate officer dashboard in this MVP; the issuer can restore its own compliance role through its locked token admin authority. General role delegation/renunciation management is not part of the requested Phase 4 screens.

## Transactions, refresh and history

The transaction bar follows awaiting wallet → submitted → pending → confirmed after a status-1 receipt. A synchronous session lock and disabled controls prevent repeated submission. Reverts and user rejection never display success. Successful speed-up/repricing receipts are accepted; cancellation or a changed replacement is not accepted as the intended action's success.

Receipt waits have a 120-second bound. A timeout/transport failure after submission means **confirmation unknown**, not transaction failure (AUD-010). The hash stays visible, duplicate actions remain disabled, and Check confirmation reads the receipt again. A null receipt keeps the unknown state; status 0 reports failure; status 1 refreshes data. A wallet/account change invalidates that session's UI without cancelling an already submitted on-chain transaction.

Public RPC requests have a 12-second timeout. Error mapping decodes compiled custom errors and handles rejection, incorrect network, insufficient ETH, ineligible endpoints, closed sales, allowance/balance/inventory failures and RPC unavailability. Per-read retry buttons are available. The UI refreshes affected data after confirmation; refresh buttons reconcile changes made in another browser/wallet. There is no push indexer or continual block polling of every UI metric.

Account-dependent reads always discard previous data on identity changes. Only the public registry retains prior data while refreshing so the selected issuer form stays mounted. Transactions still preflight fresh chain state. Failed registry refreshes show errors instead of silently keeping a successful view.

History starts at the factory deployment block and queries windows of at most 2,000 blocks. Provider range/size errors split the range adaptively; transport failures surface directly rather than recursively retrying thousands of requests. It uses actual logs, sorts by block/log index, loads timestamps when available, and renders 20 rows at a time. Sale-to-buyer `Transfer` is removed when matching a `Purchased` event, so a purchase is displayed once. Other inventory events may legitimately have their corresponding token transfer records. The UI does not call logs a complete legal ownership register.

Registry enumeration and historical log collection are suitable for a small local MVP, not a large production chain. Block windows bound each request, not total history size. No third-party indexer or replicated database was added.

## Reproducible local workflow

From the repository root:

```bash
npm ci
npm ci --prefix frontend
npm run compile
```

Terminal 1: `npm run node` (loopback 127.0.0.1:8545).

Terminal 2: `npm run deploy:local` (updates addresses and all ABIs). Optional `npm run demo:local` seeds an **empty** registry with CPT and DLT, approves the issuer and investors, and funds offerings with 5,000 CPT and 2,000 DLT. This is an explicit blockchain fixture, not hardcoded app data. It never purchases on the user's behalf and refuses a populated registry/public network. `scripts/setupDemo.ts` remains the original Phase 3 standalone demonstration.

Terminal 3: `npm run dev --prefix frontend` (http://127.0.0.1:5173).

MetaMask local network: chain 31337, RPC http://127.0.0.1:8545, ETH currency. Use separate local development accounts. Account indices 0,1,2,3,4 correspond to administrator, issuer, investor 1, investor 2, unapproved investor. Obtain their development keys directly from your own Hardhat terminal if importing into a development wallet; never paste keys into the application, chat, frontend environment or repository. These publicly known accounts must never hold real value.

Restarting the local node resets deployments. Run `deploy:local` again and restart the frontend; optionally seed again. Wallet nonce/activity state may also need clearing for the reset local development network. `deploy:ephemeral` is deliberately throwaway and does not update persistent frontend addresses. Generated addresses in this working tree identify the validation session, not a deployment that will survive node restart. The validation servers are stopped at handoff; use the three-terminal instructions to start a new session.

## Executed validation

| Command / check | Result | Evidence |
|---|---|---|
| Initial `npm run build --prefix frontend` | Failed: missing tsconfig; corrected | `baseline-build.log` |
| `npm run compile` | Pass after allowing access to external Hardhat compiler cache | `compile.log` |
| `npm test` | 108 existing contract tests pass; Solidity unchanged | `contract-tests.log` |
| `npm test --prefix frontend` | 112 frontend tests pass in 7 files | `frontend-tests.log` |
| `npm run build --prefix frontend` | Pass: TypeScript and Vite production bundle | `build.log` |
| `npx tsc --noEmit` | Pass for root scripts/tests | `root-typecheck.log` |
| `npm run test:integration` | 1 full local lifecycle test passes with actual contracts and production frontend services | `integration.log` |
| `npm run deploy:local`, `npm run demo:local` | Persistent deployment/config and two assets succeed | `deploy-local.log`, `seed-local.log` |
| HTTP GET all 5 routes | All return 200 with app shell | `http-smoke.log` |
| `npm ci --prefix frontend --ignore-scripts` | Clean locked dependency installation succeeds | `npm-ci.log` |
| `npm audit --prefix frontend --json` | Zero vulnerabilities reported | `npm-audit.json` |
| Browser/MetaMask | Not executed: browser discovery returned an empty list | Manual checklist below |

All logs are under [evidence/phase4](evidence/phase4/README.md). Unit tests use mocked providers/contracts and need no local/public RPC. They cover the requested A–F groups: wallet lifecycle; multiple/empty/failed marketplace and filters; creation permission/validation/pending/refresh/failure; exact purchase values and eligibility; compliance/allowance/deposit/proceeds/closure/recovery; holdings/transfer eligibility/account changes/activity. Additional tests cover stale-response races, deployment identity, replacement receipts, timeout recovery and bounded history/deduplication.

The integration suite creates an isolated factory on the persistent local node, signs via an EIP-1193 adapter over Hardhat's unlocked accounts and runs the production service methods. Assertions verify CPT supply 10,000; inventory 5,000 → 4,900 after purchase; investor balances 100 → 80/20 after transfer; 0.1 ETH proceeds withdrawn; permanent closure; 4,900 unsold tokens recovered; DLT supply 5,000 and a second holding of 50; independent asset whitelists; issuer revocation scope; and one purchase event instead of a duplicate purchase/transfer. Direct calls bypassing frontend preflight also prove unapproved purchases and transfers revert. This test is **not** a browser or MetaMask demonstration.

## Remaining genuine browser verification

Use a fresh unseeded `deploy:local` for the complete demonstration; seeding intentionally pre-completes administration/funding. Do not mark these checked based on mocked tests.

| Manual scenario | Expected result | Status |
|---|---|---|
| Wallet A (account 0): connect, inspect role, authorise B (account 1) | Admin role and issuer status update after confirmation | Pending |
| B creates CPT, 10,000 supply, 0.001 ETH | Correct ID/token/sale addresses and marketplace metadata | Pending |
| B whitelists sale, approves 5,000 and separately deposits | Sale balance 5,000; allowance updated | Pending |
| B approves C/D (accounts 2/3), leaves E (account 4) unapproved | Independent eligibility status | Pending |
| C buys 100 CPT | Wallet shows 0.1 ETH plus fees; receipt success; balance 100/inventory 4,900 | Pending |
| C transfers 20 to D; switch to D | C=80, D=20; no stale account data | Pending |
| E attempts purchase; reject a wallet request; switch wrong network | Blocked/rejected/error states; no false success | Pending |
| B withdraws proceeds, closes, recovers | 0.1 ETH withdrawn; no further purchases/deposits; 4,900 recovered | Pending |
| B creates/funds DLT at 5,000 supply, 0.002 ETH; C acquires DLT | Both marketplace assets and holdings; independent whitelist | Pending |
| Revoke B at factory | Creation disabled; existing asset management remains available | Pending |
| Account/chain switches while a request is loading/pending | Correct clearing and transaction feedback | Pending |
| Multiple wallet extensions, copy buttons, dialog focus, keyboard use | Correct provider selection and accessible behavior | Pending |
| Desktop ~1440px, tablet ~768px, mobile ~390px | No clipped forms/cards; tables scroll; navigation usable | Pending |

## Acceptance and Phase 5 readiness

All requested frontend features are implemented and covered by automated validation. Build, frontend behavior tests, existing contract regression tests, local service integration, HTTP serving, ABI sync, documentation and AI audit evidence are complete. **Phase 4 is not certified as fully accepted under the prompt's interactive criteria**: genuine MetaMask connection/signing, browser account/network events, and responsive visual verification remain outstanding because no browser was available. No screenshots or manual pass claims are fabricated.

For Phase 5, complete that local manual checklist, provision separate Sepolia burner wallets and test ETH, configure the existing Hardhat Sepolia RPC/private key outside the frontend, deploy with the reviewed build profile, sync actual chain/address/block/ABI configuration, set a public frontend RPC, add the appropriate explorer link configuration if desired, deploy the SPA with route fallback, and repeat the full lifecycle in MetaMask with testnet receipts. The existing one-key Sepolia configuration is not a multi-wallet demo setup. Public-network deployment, public RPC execution and final testnet verification were not performed here.

Primary references checked for integration semantics: [EIP-1193 provider API](https://eips.ethereum.org/EIPS/eip-1193), [EIP-6963 discovery](https://eips.ethereum.org/EIPS/eip-6963), and [ethers v6 documentation](https://docs.ethers.org/v6/single-page/). Repository source and compiled ABIs remained the authority for application-specific behavior.
