# Manual review record

Reviewed at initial revision `0b1249e`, then against the Phase 6 changes. Full external/public function signatures, including inherited ERC-20, AccessControl and Pausable methods, are in [contract-inventory.json](contract-inventory.json). The exact compiler inputs include OpenZeppelin implementations. Findings are not inferred from scanner severity alone.

## Contract review

| Surface | Evidence and conclusion |
|---|---|
| Token construction / supply | Only constructor calls `_mint`; nonzero issuer/supply. 0 decimals. `forcedTransfer` rejects zero source and unapproved destination (zero can never be whitelisted), so it cannot mint or burn. ERC20 base has only internal mint/burn. Factory is not granted roles. |
| Token authority | Issuer gets DEFAULT_ADMIN_ROLE and COMPLIANCE_ROLE; default admin can delegate either. `_revokeRole` blocks removal/renunciation of issuer admin, while compliance remains revocable. Ordinary approvals never grant administrative roles. Delegated admins are trusted recovery authorities. |
| Transfer / transferFrom / approvals | Both use `_update`; sender and recipient checked even at zero quantity. Spender eligibility intentionally irrelevant; allowance remains required. Revocation does not erase approvals, but those approvals cannot bypass endpoint checks. Reverts restore spent allowance. Standard ERC-20 zero-address errors preserved. |
| Pause / recovery | `_update` checks pause. D5 `forcedTransfer` deliberately calls inherited `_update` to bypass pause and revoked sender gate; explicit admin, source and destination checks replace those conditions. No external callback in production ERC20. |
| Factory | Immutable nonzero admin, authorisation controls, explicit prohibition on self-authorisation. Positive supply/price; enum decoder rejects invalid type. Name/symbol/description can be empty on chain (no contrary Phase 3 rule). IDs use array length; child deployment and registration share one atomic transaction. No user-controlled external callbacks. |
| Issuer revocation / isolation | Revocation stops new createAsset only. Deployed issuer immutable. Each token has its own roles, balances, allowances and whitelist; each sale has own proceeds and status. Intentional role delegation is the documented exception to simplistic “creator only” claims. |
| Allocation / unexpected token | Issuer-only `safeTransferFrom`; exact known AssetToken has no fee or callback. Factory always constructs it. Direct sale constructor accepts any nonzero address, including EOA; no generic-token compatibility guarantee. Such deployments are unsupported and absent from registry. SafeERC20 alone would not guarantee delivery from a malicious token. |
| Purchase / arithmetic | Open sale, positive quantity, eligible buyer, inventory, checked multiplication, exact msg.value. Proceeds update followed by safe token transfer; any transfer failure reverts entire transaction/value. Oversized price/supply may make purchases impossible, but cannot undercharge or wrap. |
| Withdrawal | Immutable issuer only. `unclaimedProceeds=0` precedes ETH call; failed call reverts accounting. Recursive withdrawal sees zero and fails unless a genuinely new paid purchase occurs. Existing tests exercise malicious issuer and rejection. No ReentrancyGuard is claimed. |
| Excess ETH | Sweep pays only balance minus proceeds; call debits balance before callback. Reentry cannot resweep the same excess. Cross-function withdrawal during sweep should pay owed proceeds once; additional adversarial tests verify. Plain ETH rejects, forced ETH can arrive. |
| Close / recover | Closure irreversible, only issuer, blocks buys and allocation. Recovery requires closed status and positive token balance, with normal eligibility/pause rules. Reapprove issuer/sale and unpause to recover; D5 provides explicit emergency recovery. No restriction silently removed. |
| Other attack classes | No tx.origin, delegatecall, public selfdestruct, oracle, timestamp logic, upgrade hook or production assembly in owned contracts. Solidity 0.8 checked arithmetic; unchecked inherited balance operations rely on preceding checks and supply conservation. Caller pays metadata/deployment gas; batch creation is not implemented. |

## Frontend / tooling review

Read services/blockchain, wallet, transactions and history; all contexts/hooks, pages, forms and configuration; tests, deployment/sync/seed/replay scripts and build configuration.

- Public reads use configured RPC; all writes use BrowserProvider. Account/chain changes invalidate account data with session keys and cleanup listeners. Late results do not restore previous permissions. Signer rechecks account and chain. Deployment validation initially ran only on public RPC: tracked for failing-before regression (SEC-013/AUD-016).
- Every write method maps to compiled ABI; approval and allocation are separate. BigInt handles quantities, wei, supplies and IDs; uint256 and decimal bounds checked. Asset category conversion is restricted to 0/1.
- Receipt handling distinguishes submission, pending, success, failure, rejection and unknown confirmation. Repriced replacements accepted only on success; no-receipt paths retain hash and block repeat submission in the active session. Reloading/disconnecting loses in-memory pending tracking: operational limitation, not durable duplicate protection.
- Portfolio uses balanceOf, not events as balances. History queries token/sale addresses and bounded block ranges, splits range-limit failures, suppresses purchase/forced-transfer companion Transfer rows and scopes account views. Provider completeness/reorg finality remains assumed; no indexer or exhaustive account history pagination.
- JSX renders metadata as text, no dangerouslySetInnerHTML. Visible academic disclaimer disclaims legal ownership/investment claims. UI issuer approvals are simulated compliance, not real KYC. Legacy sidebar “PHASE 04 / LOCAL DEVELOPMENT” is inaccurate on Sepolia and should reflect configured network.
- Issuer dashboard intentionally lists assets by immutable issuer; delegated compliance/admin addresses may use contracts directly. Pause/forced-transfer controls are not in the UI. Paused writes revert and cannot falsely confirm, but pause is not shown as a dedicated disabled UI state.
- Deployments save chain ID, factory, block/hash, runtime hash and ABIs. No .env file was read. No public transactions requested. Existing testnet log is an empty template, not evidence of deployment.

## Evidence limitations

Tests cannot rule out all adversarial call sequences or compiler faults. Finite seeded state sequences are regression instrumentation, not mathematical proof. Full browser/MetaMask interaction is separate from mocked wallet/component and real-chain adapter tests. Git author labels are evidence of repository attribution, not proof of independent human authorship.
