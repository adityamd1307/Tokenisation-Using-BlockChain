# Spec v1: frozen specification

Status: FROZEN. No `TODO(decision)` markers remain.

Phase 2 update (23 October 2026): the user's later [Phase 2 requirements](phase2-requirements.md) govern token implementation where they differ from this historical specification. In particular, AccessControl delegates compliance administration, revoking eligibility preserves existing balances, and pause/freeze/forced transfer are not implemented in this phase. See [implementation decisions](../phase2-implementation.md) for the exact API and scope. The original requirements below remain preserved for audit comparison.

Phase 3 update (23 October 2026): the user's later [Phase 3 requirements](phase3-requirements.md) govern AssetFactory and AssetSale where they differ from this historical specification. In particular, the function names change (`authorizeIssuer`, `revokeIssuer`, `buyTokens`, `pricePerToken`), the registry gains `getAsset` / `getAssetCount` with description and asset-type metadata, and a sale can be closed so unsold inventory can be recovered. The decisions are recorded in that file. The reentrancy requirement and invariant 8 below still apply.

Decision D5 (opened 23 October 2026 in [phase3-requirements.md](phase3-requirements.md); decided 3 November 2026): **pause and forced transfer are implemented; freeze is dropped.** Freeze adds nothing because whitelist revocation already does the same job. Since Phase 2 §2.3, a revoked holder keeps their balance but can neither send, receive nor buy (invariant 1). So "freeze" in this spec now means revoking eligibility with `setWhitelisted(addr, false)`. The governing function rows are in §5 under "D5 functions", and invariants 1, 5, 6 and 7 are restated. Everywhere else, a mention of freeze (§1 "Why a blockchain", the §3 issuer row, the §4 `frozen` mapping and feature list, the §5 `freeze` / `unfreeze` rows) is superseded and kept only for audit comparison. Implemented in 714366d (tag `ai-baseline-d5`) and reviewed before merge; see [D5 implementation and review](../d5-implementation.md). *Superseded sentence: "Until the code lands, the D5 functions describe intended behaviour, not implemented behaviour."* A consequence for the §1 trust model: anyone the issuer grants `DEFAULT_ADMIN_ROLE` can now force-transfer revoked holdings, so that grant extends the issuer's trust to them.

Phase 4 update (28 October 2026): the later [Phase 4 requirements](phase4-requirements.md) authorise building the frontend against the already implemented contracts and prohibit unnecessary Solidity redesign. They supersede the historical instruction to block Phase 4 on D5. Pause/freeze/forced transfer remain unsupported and are not fabricated in the UI. See [Phase 4 implementation and verification limits](../phase4-implementation.md). *(Note added at the D5 merge, 4 November 2026: this was true when written. Pause and forced transfer are now implemented on the contract. The UI still has no controls for them, but its history shows forced transfers (AUD-013).)*

Phase 5 update (5 November 2026): the later [Phase 5 requirements](phase5-requirements.md) govern the demo wallets and networks. Task 5.1 uses four wallets: A is the platform administrator, B the authorised issuer, C an approved investor and D an initially unapproved investor. This replaces the wallet rows in §2 and the test-wallet line in §9. Sepolia keys are `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D` (D12), which replace `PRIVATE_KEY` in §9. The second demo asset is DLP as in §2, with the quantities in D17.

How this version was produced: human decisions, with AI-assisted research. The research sessions are logged in `docs/ai-logs/INDEX.md`. Changes from `spec-v0.md` are explained in section 10.

## 1. Problem and trust model

**Problem**: real-world asset ownership is opaque, settlement is slow, and compliance tracking is manual. Traditional fund administration relies on intermediaries for record-keeping, transfer approval, and settlement, introducing delay and counterparty risk.

**Why a blockchain**: an Ethereum smart contract provides an immutable, publicly auditable share register. Transfer rules (whitelist, freeze, pause) are enforced in code rather than by a custodian. Settlement is atomic — a buyer pays ETH and receives tokens in a single transaction, eliminating counterparty risk. No intermediary can alter the ownership record.

**Trust model**: the issuer is trusted to correctly describe the off-chain asset and to maintain the legal register that backs the tokens. The on-chain token is a share register only — the legal claim (e.g. beneficial interest in the fund) sits off-chain in a subscription agreement. The platform admin is trusted to authorise only legitimate issuers.

**Out of trust scope**: oracle price accuracy, issuer solvency, off-chain legal enforceability.

## 2. Asset and scope

Instrument: **fictional real estate investment fund** — Campus Property Fund.

| Field | Value |
|---|---|
| Token name | Campus Property Token |
| Symbol | CPT |
| Total supply | 10 000 CPT |
| Token decimals | 0 (whole units) |
| Initial sale price | 0.001 testnet ETH / token |
| Platform admin | MetaMask Wallet A (Phase 5) |
| Issuer | MetaMask Wallet B (Phase 5). *Superseded: Wallet A* |
| Investor 1 (approved) | MetaMask Wallet C (Phase 5). *Superseded: Wallet B* |
| Investor 2 (initially unapproved) | MetaMask Wallet D (Phase 5). *Superseded: Wallet C* |

A second demo asset, Digital Licensing Revenue Pool (symbol: DLP), will be deployed using the same contracts with different metadata to demonstrate the multi-asset registry.

Both assets are ERC-20 tokens representing fractional interests in a fictional fund. Tokenising unique NFTs or enforcing actual intellectual-property rights is out of scope.

## 3. Roles

| Actor | Can | Cannot |
|---|---|---|
| Platform admin | authorise issuer wallets; deauthorise issuer wallets | hold tokens; buy assets |
| Authorised issuer | create assets (sets token name, symbol, supply, sale price at creation); whitelist investor addresses; allocate tokens to the sale contract; withdraw ETH proceeds from the sale contract; freeze an individual investor address; unfreeze; pause all transfers; unpause | control another issuer's asset; change the sale price after creation |
| Investor | connect wallet; buy tokens from the sale contract (if whitelisted); transfer tokens to another whitelisted address; view own balance | buy if not whitelisted; transfer to non-whitelisted address |

An issuer cannot modify the whitelist, freeze state, or pause state of a token they did not deploy.

## 4. Contracts and state

### AssetToken.sol

Purpose: ERC-20 token with compliance controls.

State variables:
- `address public issuer` — set at deployment, immutable in practice
- `mapping(address => bool) public whitelist` — addresses permitted to hold and transfer tokens
- `bool public paused` — when true, all transfers revert
- `mapping(address => bool) public frozen` — individual addresses barred from sending or receiving

Calls: none external (pure ERC-20 logic + compliance hooks).

**Price model**: fixed price set at deployment, stored in AssetSale (not AssetToken). AssetToken has no knowledge of price.

**Extra features in scope**: whitelist (required to receive or send), pause (issuer halts all transfers globally), freeze (issuer bars one address), forced transfer (issuer can move tokens out of a frozen address to recover them).

**Out of scope for AssetToken**: redemption, yield/dividend, NAV oracle, upgradeability.

### AssetFactory.sol

Purpose: authorise issuers; deploy and register asset contracts.

State variables:
- `address public admin` — platform admin, set in constructor
- `mapping(address => bool) public authorisedIssuers`
- `address[] public assets` — list of all deployed AssetToken addresses
- `mapping(address => address) public tokenToSale` — maps each AssetToken to its AssetSale

Calls: deploys `AssetToken` and `AssetSale`.

### AssetSale.sol

Purpose: hold sale inventory; accept fixed-price ETH payments; hold proceeds for issuer withdrawal.

State variables:
- `AssetToken public token`
- `uint256 public priceWei` — fixed price per token in wei, set at deployment
- `address public issuer`

**DvP design**: escrow. The issuer calls `allocate(amount)`, transferring tokens from their wallet into the AssetSale contract. A buyer calls `buy(amount)` with `msg.value == amount * priceWei`; tokens transfer to the buyer immediately and ETH is held in the contract. The issuer later calls `withdrawProceeds()` to collect ETH.

**Subscription flow**: instant. `buy` reverts if the caller is not whitelisted or if the contract holds fewer tokens than requested; otherwise the transfer is immediate with no approval queue.

**Reentrancy requirement**: `withdrawProceeds` must use the checks-effects-interactions pattern — zero the internal ETH balance before calling out — or apply a reentrancy guard. An issuer whose address is a contract could otherwise re-enter and drain more ETH than owed.

## 5. Functions

Every external function, who may call it, preconditions, effects, events emitted, and what must revert.

| Function | Caller | Preconditions | Effects | Event | Reverts if |
|---|---|---|---|---|---|
| `AssetFactory.authoriseIssuer(address)` | admin | — | `authorisedIssuers[addr] = true` | `IssuerAuthorised(addr)` | caller != admin; addr already authorised |
| `AssetFactory.deauthoriseIssuer(address)` | admin | addr is authorised | `authorisedIssuers[addr] = false` | `IssuerDeauthorised(addr)` | caller != admin; addr not authorised. **Note**: deauthorisation prevents future calls to `createAsset` only. Existing deployed AssetToken and AssetSale contracts continue operating; the admin cannot revoke an issuer's authority over contracts they have already deployed. |
| `AssetFactory.createAsset(name, symbol, supply, priceWei)` | authorised issuer | priceWei > 0; supply > 0 | deploys AssetToken, mints supply to issuer; deploys AssetSale; records both in registry | `AssetCreated(token, sale, issuer)` | caller not authorised |
| `AssetToken.addToWhitelist(address)` | issuer | — | `whitelist[addr] = true` | `Whitelisted(addr)` | caller != issuer |
| `AssetToken.removeFromWhitelist(address)` | issuer | addr has zero balance | `whitelist[addr] = false` | `RemovedFromWhitelist(addr)` | caller != issuer; addr has non-zero balance. **Recovery flow when addr is frozen**: issuer must (1) call `forcedTransfer(addr, safeAddr, balance)` to empty addr's holdings, then (2) call `removeFromWhitelist(addr)`. |
| `AssetToken.transfer(to, amount)` | token holder | `whitelist[to]`; `!paused`; `!frozen[from]`; `!frozen[to]` | standard ERC-20 transfer | `Transfer(from, to, amount)` | any precondition false |
| `AssetToken.transferFrom(from, to, amount)` | approved spender | same as transfer | same as transfer | `Transfer` | any precondition false |
| `AssetToken.pause()` | issuer | `!paused` | `paused = true` | `Paused()` | caller != issuer; already paused |
| `AssetToken.unpause()` | issuer | `paused` | `paused = false` | `Unpaused()` | caller != issuer; not paused |
| `AssetToken.freeze(address)` | issuer | `!frozen[addr]` | `frozen[addr] = true` | `Frozen(addr)` | caller != issuer; already frozen |
| `AssetToken.unfreeze(address)` | issuer | `frozen[addr]` | `frozen[addr] = false` | `Unfrozen(addr)` | caller != issuer; not frozen |
| `AssetToken.forcedTransfer(from, to, amount)` | issuer | `whitelist[to]`; `!frozen[to]` | transfers regardless of `frozen[from]` and regardless of `paused` — this is the issuer's emergency recovery mechanism | `ForcedTransfer(from, to, amount)` | caller != issuer; `to` not whitelisted; `to` is frozen |
| `AssetSale.allocate(uint256 amount)` | issuer | issuer ERC-20 balance >= amount; issuer has approved AssetSale | transfers tokens from issuer to AssetSale | `Allocated(amount)` | caller != issuer; balance insufficient |
| `AssetSale.buy(uint256 amount)` | investor | `whitelist[msg.sender]`; `msg.value == amount * priceWei`; AssetSale token balance >= amount | transfers tokens to buyer; ETH held in contract | `Purchased(buyer, amount)` | any precondition false |
| `AssetSale.withdrawProceeds()` | issuer | ETH balance > 0 | sends full ETH balance to issuer | `ProceedsWithdrawn(amount)` | caller != issuer; no ETH to withdraw |

### D5 functions (decided 3 November 2026; these supersede the `pause`, `unpause`, `freeze`, `unfreeze` and `forcedTransfer` rows above)

"Admin" here means a holder of `DEFAULT_ADMIN_ROLE` on that AssetToken. The issuer always holds this role (D6).

| Function | Caller | Preconditions | Effects | Event | Reverts if |
|---|---|---|---|---|---|
| `AssetToken.pause()` | admin | not paused | paused. Every token movement except `forcedTransfer` now reverts: `transfer`, `transferFrom`, and through them `AssetSale.allocate`, `buyTokens` and `recoverUnsoldTokens` | `Paused(account)` (OpenZeppelin `Pausable`) | caller is not admin; already paused |
| `AssetToken.unpause()` | admin | paused | unpaused | `Unpaused(account)` (OpenZeppelin `Pausable`) | caller is not admin; not paused |
| `AssetToken.forcedTransfer(from, to, amount)` | admin | `from` is not the zero address; `from` is not whitelisted (its eligibility was revoked); `to` is whitelisted | moves `amount` from `from` to `to`, whether or not the token is paused. `totalSupply` is unchanged | `Transfer(from, to, amount)` and `ForcedTransfer(from, to, amount)` | caller is not admin; `from` is the zero address; `from` is whitelisted; `to` is not whitelisted; `amount` exceeds `from`'s balance |

Recovery flow (for a lost key, or after a compliance removal): the admin calls `setWhitelisted(from, false)`, then `forcedTransfer(from, safeAddr, balance)`. Requiring revocation first means a live investor or the sale contract cannot be drained without an earlier `WhitelistUpdated` event on chain. The zero-address check is needed because OpenZeppelin's `_update` treats a move from `address(0)` as a mint. `address(0)` is never whitelisted, so without the check `forcedTransfer` could create tokens.

## 6. Invariants

Properties that must hold after any sequence of calls. These become invariant and unit tests.

1. **Eligibility invariant** (restated by AUD-005, then by D5): every token movement (`transfer`, `transferFrom`, a sale purchase) has a whitelisted sender and a whitelisted recipient. The one exception is `forcedTransfer`, whose sender must *not* be whitelisted (invariant 6). A holder whose eligibility is revoked keeps their balance unless the admin force-transfers it. Until re-approved, they can neither send, receive nor buy. *Superseded wording (AUD-005), kept for audit comparison: "every token movement — `transfer`, `transferFrom`, a sale purchase — has a whitelisted sender and a whitelisted recipient. A holder whose eligibility is revoked keeps their balance but can neither send nor receive, nor buy, until re-approved." Original wording: "every address with a non-zero CPT balance is on the whitelist (`balanceOf(addr) > 0 → whitelist[addr] == true`)". That cannot hold since Phase 2 §2.3, which requires revocation to preserve balances.*
2. **Supply invariant**: `totalSupply()` equals the sum of all individual balances at all times.
3. **Sale proceeds invariant** (restated by AUD-007, decision D7): `unclaimedProceeds` equals the total ETH paid by buyers minus the total withdrawn by the issuer, and is ≤ the ETH balance of AssetSale. Any excess is ETH forced in by `selfdestruct` or a coinbase reward, and the issuer can recover it with `sweepExcessETH()`. *Superseded wording: "ETH held by AssetSale equals the total ETH paid by buyers minus total ETH withdrawn by the issuer". That cannot be guaranteed, because ETH can be forced into any contract.*
4. **Transfer gate invariant**: no transfer to a non-whitelisted address ever succeeds; every such attempt reverts.
5. **Pause invariant** (restated by D5): while the token is paused, no token movement succeeds except `forcedTransfer` called by an admin. That includes `transfer`, `transferFrom`, and AssetSale's `allocate`, `buyTokens` and `recoverUnsoldTokens`. *Superseded wording: "when `paused == true`, no `transfer` or `transferFrom` succeeds (except `forcedTransfer` by issuer)".*
6. **Forced-transfer invariant** (replaces the freeze invariant, D5): `forcedTransfer` only succeeds when the caller holds `DEFAULT_ADMIN_ROLE`, `from` is a non-zero address that is not whitelisted, and `to` is whitelisted. It never changes `totalSupply`. *Superseded freeze invariant: "when `frozen[addr] == true`, `addr` cannot send tokens via `transfer` or `transferFrom`". Under D5 that property is covered by invariant 1, because a revoked address cannot send.*
7. **Issuer isolation invariant**: address X can only call `addToWhitelist`, `pause`, `forcedTransfer`, `allocate`, or `withdrawProceeds` on an AssetToken / AssetSale that X deployed. (`freeze` was removed from this list by D5.)
8. **Reentrancy invariant**: after `withdrawProceeds` completes, the ETH balance tracked by AssetSale is zero, regardless of any re-entrant calls made during the ETH send. Implementation must zero the balance before the external call.

## 7. Frontend

**Admin dashboard** (`/admin`)
- Shows: list of authorised issuers (from `AssetFactory`)
- Actions: authorise new issuer (enter address → `authoriseIssuer`); deauthorise (→ `deauthoriseIssuer`)
- Contract calls: `AssetFactory.authorisedIssuers`, `AssetFactory.authoriseIssuer`, `AssetFactory.deauthoriseIssuer`

**Issuer dashboard** (`/issuer`)
- Shows: list of assets the connected wallet deployed; per-asset: token balance, AssetSale inventory, ETH proceeds
- Actions: create new asset (form: name, symbol, supply, price → `createAsset`); allocate tokens (enter amount → approve then `allocate`); whitelist investor (enter address → `addToWhitelist`); withdraw proceeds (→ `withdrawProceeds`)
- Contract calls: `AssetFactory.createAsset`, `AssetToken.addToWhitelist`, `AssetSale.allocate`, `AssetSale.withdrawProceeds`

**Investor dashboard** (`/investor`)
- Shows: all assets in factory registry; for each: name, symbol, price, available tokens; own holdings
- Actions: buy tokens (enter amount, pay ETH → `buy`); transfer tokens (enter recipient + amount → `transfer`)
- Contract calls: `AssetFactory.assets`, `AssetSale.buy`, `AssetToken.transfer`

Each page connects via MetaMask using ethers.js `BrowserProvider`. Deployed contract addresses are read from a JSON config file generated by the deploy script.

## 8. Out of scope

- NFT-based unique assets — per-asset complexity out of MVP scope
- Redemption / buyback — out of scope
- Yield / dividend distribution — out of scope
- NAV oracle or price updates after creation — out of scope; price is fixed at deployment
- Multi-jurisdiction compliance rules beyond a single whitelist — out of scope
- Actual legal enforceability of the on-chain record — out of scope
- Governance or on-chain voting — out of scope
- Gas optimisation for large investor sets — out of scope for MVP

## 9. Assumptions

- Network: Sepolia testnet (chain ID 11155111) for integration; Hardhat local network (chain ID 31337) for development
- Token decimals: 0 — whole units only, consistent with fractional-unit model where each token represents one equal share
- Test wallets (restated for Phase 5): Hardhat accounts 0–3 play Wallets A–D in the local runs of the Phase 5 scripts, and four MetaMask burner wallets A–D are used on Sepolia. *Superseded: "three Hardhat accounts (index 0 = admin, 1 = issuer, 2 = investor) for local tests; three MetaMask burner wallets on Sepolia for demo". The Phase 3 tests still use indices 0–2 that way.*
- Toolchain: Node.js ≥ 18, Hardhat 3.x (installed: 3.21.0), OpenZeppelin Contracts 5.x (installed: 5.6.1), ethers.js 6.x
- Frontend: React 18, Vite, ethers.js 6.x
- Secrets (restated for Phase 5, D12): `TESTNET_RPC_URL` and `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D` come from environment variables or Hardhat's encrypted keystore. They are never committed. *Superseded: "`.env` holds `TESTNET_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY` — never committed". Nothing loads `.env` automatically, and the Phase 5 brief does not ask for Etherscan verification.*

## 10. Changes from v0

AI influence is classified from the research transcript (`docs/ai-logs/exports/2026-10-23-claude-ai-research.md`, cited as R<line>):
- **AI proposed, human adopted**: the AI recommended this and we took it.
- **AI offered, human chose otherwise**: the AI laid out options and we picked a different one.
- **No AI proposal found**: the transcript does not contain it.

Audit-1 finding F-07 showed the earlier "No" values were wrong. That "correction" (commit a609765) had itself been proposed by the Phase 1 AI session, `phase1-setup.txt` lines 1860–1867. The superseded values remain in git history.

| Change | Why | AI influence |
|---|---|---|
| Narrowed scope to one real-estate fund + one digital asset | Keeps MVP deliverable within project timeline | AI offered, human chose otherwise. The AI recommended a tokenised money-market fund, with a bond and gold as alternatives (R240–244). |
| Defined three concrete contracts (AssetToken, AssetFactory, AssetSale) | Makes responsibilities and security boundaries explicit | AI offered, human chose otherwise. The AI proposed an ERC-3643-style split: IdentityRegistry, ComplianceRules, AssetToken, Issuance, DvPSettlement (R62–66, R304–310). We chose three contracts. The name `AssetToken` matches the AI's proposal (R64). |
| Fixed sale price set at deployment (not issuer-set NAV) | Eliminates price oracle dependency; simplifies MVP | AI offered, human chose otherwise. The AI recommended issuer-set NAV and listed a fixed price as the simpler option (R265–267). |
| Instant subscription flow (not request-and-approve) | Reduces contract complexity; investor experience is clearer | AI proposed, human adopted (R270). |
| Escrow DvP in AssetSale (spec-v1 §4) | Sale contract holds inventory and proceeds | AI offered, human chose otherwise. The AI recommended approve-based DvP without escrow (R258–259). |
| Whitelist + pause + freeze + forced transfer as in-scope features | Directly addresses the "permissioning and compliance" requirement from v0 | AI proposed, human adopted. Freeze, forced transfer and pause were all rated "Must" (R296–297). D5 (3 November 2026) kept pause and forced transfer and dropped freeze, because whitelist revocation already does what freeze would. That narrowing was AI proposed, human adopted, in a Claude Code (claude-opus-5-5) session. |
| Frontend split into three role-based dashboards | Matches the three-role model; each role sees only relevant actions | No AI proposal found. The AI suggested a different role split: Issuer, Compliance Agent, Investor (R310). |
