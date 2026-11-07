# Threat model — Phase 6

Scope: factory-created AssetToken/AssetSale pairs and the repository's React client, deployment scripts and public-RPC configuration. On-chain token balances represent simulated units; neither the register nor a whitelist proves off-chain custody, KYC, legal title, solvency or enforceable investment rights.

## Assets and boundaries

| Actor / boundary | Trusted powers and assets at risk |
|---|---|
| Platform administrator | Immutable factory admin; authorises/revokes creation rights. Loss of its key prevents future issuer administration; no replacement function. Cannot directly administer existing assets. The self-authorisation restriction is wallet policy, not Sybil resistance. |
| Asset issuer | Receives supply and immutable sale proceeds rights; permanently retains token DEFAULT_ADMIN_ROLE. Can delegate both admin and compliance roles, pause, revoke and force-transfer revoked holdings. Privileged confiscation is explicitly in scope (D5); investors must trust issuer and delegated admins. |
| Compliance administrator | COMPLIANCE_ROLE changes investor, issuer and sale eligibility for that token. Revocation freezes existing holdings without burning. Does not itself grant pause/recovery/admin powers. |
| Investor / external attacker | Controls approvals and eligible holdings. Anyone may call contracts directly; UI validation is not access control. Approved spender need not be eligible, but both token endpoints must be. |
| Contract issuer / contract investor | ETH withdrawal callbacks are adversarial. Production ERC-20 transfer has no recipient hook. SafeERC20 handles failure, not arbitrary malicious token economics. Only factory-created known tokens are supported. |
| Public RPC / wallet RPC | Reads and signing can reach different nodes with the same chain ID, especially local chains. Verify chain, deployment code and deployment block on both. Malicious providers can lie; wallet signing and RPC integrity remain trust assumptions. |
| Browser / UI | Account/chain events invalidate permissions, balances and transaction display. Unconfirmed submissions must not appear successful. Metadata is untrusted text. Vite variables are public; signing secrets never belong in the client. |

Assets: issuer and investor tokens; escrow inventory; sale ETH/proceeds; whitelist and role state; registry identity/IDs; wallet account/network and pending transaction state; truthful event history and balances. A compromised issuer can revoke and recover assets by design. A compromised platform admin cannot bypass each token's roles, but can authorise misleading new assets.

## Invariants and validation targets

| ID | Property | Enforcement / tests |
|---|---|---|
| I01 | Fixed total supply and controlled-actor balance conservation | Constructor mint only, zero-source forced transfer forbidden; token/D5 and seeded security sequences |
| I02 | Unauthorised creation and issuer management fail | Factory modifiers/mapping; factory and security access matrix |
| I03 | Only compliance-role holders change eligibility | AccessControl; token role and privilege-escalation tests |
| I04 | Direct/delegated movements require eligible endpoints | `_update`, including zero transfers; deliberate D5 forced-transfer exception |
| I05 | Buyers must be eligible, including contracts and revoked holders | Sale buyer check and token delivery gate |
| I06 | Exact quantity × wei price, no overflow or overselling | Checked uint256 arithmetic, inventory guard, payment boundary tests |
| I07 | Failed purchases revert inventory, proceeds and ETH value atomically | Revert assertions and state snapshots; mined failure still costs gas |
| I08 | Only immutable issuer withdraws/sweeps/closes/recovers | Sale access matrix; recursive and cross-function callback harness |
| I09 | Asset balances, roles, prices, inventories, proceeds, closure independent | Different-issuer two-asset fixture and state sequences |
| I10 | Closure irreversible; deposits/purchases blocked, eligible inventory recoverable | Sale tests; exact Phase 6 lifecycle |
| I11 | Factory never inherits token issuer/admin/compliance authority | Factory deployment assertions, registry token-to-sale consistency |
| I12 | Portfolio uses balanceOf; history uses genuine address-scoped events | Frontend service/history tests and local service integration |
| I13 | Intended chain/deployment/account checked before requesting signing | Wallet and configuration tests; signing-provider mismatch regression |
| I14 | Owed proceeds ≤ sale ETH; forced ETH is separate and recoverable | CEI withdrawal, sweep and forced-ETH/callback tests |

## Operational assumptions and exclusions

Revoking issuer/sale eligibility or pausing prevents allocation, purchase or ordinary recovery; it does not destroy balances. Issuer can restore compliance authority, reapprove and unpause; D5 recovery can move revoked inventory even while paused. Lost issuer keys remain a liveness risk. Factory authorisation revocation affects only new assets. Admin grants deliberately cross isolation boundaries; isolation is not an assertion that delegation is impossible.

No external mint/burn, price oracle, delegatecall, upgradeability, redemption, yield or legal registry integration exists. A directly deployed sale can point at an EOA or hostile token: its constructor only rejects zero. Such a sale is outside the factory registry and is not a supported deployment. Metadata strings have no on-chain nonempty/length requirement; frontend requires name/symbol. Long metadata costs caller gas and can make aggregate UI reads expensive. The registry has sequential bounded getters; the frontend currently loads all assets in batches of ten.

Tests are finite observations, not proof. Frontend preflight cannot prevent changes after the wallet opens or dishonest provider responses. Actual MetaMask acceptance and public deployment require separate evidence. This model was written before new static scans and adversarial tests.
