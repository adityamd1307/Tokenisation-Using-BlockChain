# Spec v1: frozen specification

Status: FROZEN. No `TODO(decision)` markers remain.

Phase 2 update (23 October 2026): the user's later [Phase 2 requirements](phase2-requirements.md) govern token implementation where they differ from this historical specification. In particular, AccessControl delegates compliance administration, revoking eligibility preserves existing balances, and pause/freeze/forced transfer are not implemented in this phase. See [implementation decisions](../phase2-implementation.md) for the exact API and scope. The original requirements below remain preserved for audit comparison.

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
| Issuer | MetaMask Wallet A |
| Investor 1 | MetaMask Wallet B |
| Investor 2 | MetaMask Wallet C |

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

## 5. Functions

Every external function, who may call it, preconditions, effects, events emitted, and what must revert.

| Function | Caller | Preconditions | Effects | Event | Reverts if |
|---|---|---|---|---|---|
| `AssetFactory.authoriseIssuer(address)` | admin | — | `authorisedIssuers[addr] = true` | `IssuerAuthorised(addr)` | caller != admin; addr already authorised |
| `AssetFactory.deauthoriseIssuer(address)` | admin | addr is authorised | `authorisedIssuers[addr] = false` | `IssuerDeauthorised(addr)` | caller != admin; addr not authorised |
| `AssetFactory.createAsset(name, symbol, supply, priceWei)` | authorised issuer | priceWei > 0; supply > 0 | deploys AssetToken, mints supply to issuer; deploys AssetSale; records both in registry | `AssetCreated(token, sale, issuer)` | caller not authorised |
| `AssetToken.addToWhitelist(address)` | issuer | — | `whitelist[addr] = true` | `Whitelisted(addr)` | caller != issuer |
| `AssetToken.removeFromWhitelist(address)` | issuer | addr has zero balance | `whitelist[addr] = false` | `RemovedFromWhitelist(addr)` | caller != issuer; addr has non-zero balance |
| `AssetToken.transfer(to, amount)` | token holder | `whitelist[to]`; `!paused`; `!frozen[from]`; `!frozen[to]` | standard ERC-20 transfer | `Transfer(from, to, amount)` | any precondition false |
| `AssetToken.transferFrom(from, to, amount)` | approved spender | same as transfer | same as transfer | `Transfer` | any precondition false |
| `AssetToken.pause()` | issuer | `!paused` | `paused = true` | `Paused()` | caller != issuer; already paused |
| `AssetToken.unpause()` | issuer | `paused` | `paused = false` | `Unpaused()` | caller != issuer; not paused |
| `AssetToken.freeze(address)` | issuer | `!frozen[addr]` | `frozen[addr] = true` | `Frozen(addr)` | caller != issuer; already frozen |
| `AssetToken.unfreeze(address)` | issuer | `frozen[addr]` | `frozen[addr] = false` | `Unfrozen(addr)` | caller != issuer; not frozen |
| `AssetToken.forcedTransfer(from, to, amount)` | issuer | `whitelist[to]`; `!paused`; `!frozen[to]` | transfers regardless of `frozen[from]` | `ForcedTransfer(from, to, amount)` | caller != issuer; preconditions on `to` false |
| `AssetSale.allocate(uint256 amount)` | issuer | issuer ERC-20 balance >= amount; issuer has approved AssetSale | transfers tokens from issuer to AssetSale | `Allocated(amount)` | caller != issuer; balance insufficient |
| `AssetSale.buy(uint256 amount)` | investor | `whitelist[msg.sender]`; `msg.value == amount * priceWei`; AssetSale token balance >= amount | transfers tokens to buyer; ETH held in contract | `Purchased(buyer, amount)` | any precondition false |
| `AssetSale.withdrawProceeds()` | issuer | ETH balance > 0 | sends full ETH balance to issuer | `ProceedsWithdrawn(amount)` | caller != issuer; no ETH to withdraw |

## 6. Invariants

Properties that must hold after any sequence of calls. These become invariant and unit tests.

1. **Whitelist invariant**: every address with a non-zero CPT balance is on the whitelist. (`balanceOf(addr) > 0 → whitelist[addr] == true`)
2. **Supply invariant**: `totalSupply()` equals the sum of all individual balances at all times.
3. **Sale proceeds invariant**: ETH held by AssetSale equals the total ETH paid by buyers minus total ETH withdrawn by the issuer.
4. **Transfer gate invariant**: no transfer to a non-whitelisted address ever succeeds; every such attempt reverts.
5. **Pause invariant**: when `paused == true`, no `transfer` or `transferFrom` succeeds (except `forcedTransfer` by issuer).
6. **Freeze invariant**: when `frozen[addr] == true`, `addr` cannot send tokens via `transfer` or `transferFrom`.
7. **Issuer isolation invariant**: address X can only call `addToWhitelist`, `pause`, `freeze`, `forcedTransfer`, `allocate`, or `withdrawProceeds` on an AssetToken / AssetSale that X deployed.

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
- Test wallets: three Hardhat accounts (index 0 = admin, 1 = issuer, 2 = investor) for local tests; three MetaMask burner wallets on Sepolia for demo
- Toolchain: Node.js ≥ 18, Hardhat 2.x, OpenZeppelin Contracts 5.x, ethers.js 6.x
- Frontend: React 18, Vite, ethers.js 6.x
- `.env` holds `TESTNET_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY` — never committed

## 10. Changes from v0

| Change | Why | AI influence |
|---|---|---|
| Narrowed scope to one real-estate fund + one digital asset | Keeps MVP deliverable within project timeline | No |
| Defined three concrete contracts (AssetToken, AssetFactory, AssetSale) | Makes responsibilities and security boundaries explicit | AI research session 2026-10-23 (docs/ai-logs/exports/2026-10-23-claude-ai-research.md) |
| Fixed sale price set at deployment (not issuer-set NAV) | Eliminates price oracle dependency; simplifies MVP | No |
| Instant subscription flow (not request-and-approve) | Reduces contract complexity; investor experience is clearer | No |
| Whitelist + pause + freeze + forced transfer as in-scope features | Directly addresses the "permissioning and compliance" requirement from v0 | No |
| Frontend split into three role-based dashboards | Matches the three-role model; each role sees only relevant actions | No |
