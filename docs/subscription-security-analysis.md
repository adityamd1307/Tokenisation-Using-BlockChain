# Subscription security review

Review date: 7 November 2026. This is AI-assisted source review, static analysis and adversarial testing, not independent professional certification. No confirmed unresolved critical defect was found within the supported MockUSD/registered AssetToken scope. Browser acceptance and public-network deployment remain unverified.

## Trust boundaries and controls

| Risk | Implemented control | Evidence / residual limitation |
|---|---|---|
| Reentrant token interactions | Storage-based OpenZeppelin ReentrancyGuard on all mutating offering operations; effects before payouts; SafeERC20 | Incoming callback, refund cross-function callback, proceeds, claims and inventory-recovery tests. Storage guard remains compatible with configured Shanghai target |
| Premature issuer extraction | Only settled accepted payment becomes recognised proceeds; withdrawal subtracts prior withdrawals | Integration withdraws issuer proceeds before investor refunds while preserving all liabilities |
| Rounding and false soft-cap success | Full-precision floor allocation; conservative accepted-funding lower bound | Gross-demand/rounded-net regression, zero allocation, seven-unit dust, exact thresholds, large products and seeded conservation tests |
| Split-wallet manipulation | Whitelist gates participants; n counts distinct positive subscribers | Additional eligible wallets can reduce the conservative bound and force failure. This is a documented economic/liveness limitation, not solved by whitelisting alone |
| Inventory double pledge | Existing fixed-supply tokens physically move into independent escrows | Direct sale plus two offering tests; insufficient remaining issuer balance prevents funding twice |
| Unsold recovery steals claims | Reserve upper bound until all accounting settles, then exact outstanding allocations | Recovery before claims and seven-unit remainder tests |
| Revoked/paused investor cannot claim | Existing AssetToken enforcement remains intact; settlement/refund do not transfer restricted tokens | Revocation and pause tests; allocation remains indefinitely, and refund remains withdrawable |
| Privileged issuer seizure | Explicit inherited trust, not bypassed | Existing default admins can revoke an offering and forced-transfer its asset inventory. Finalisation can fail on inadequate inventory; seizure after success can still block delivery. Payment acceptance is not automatically reversed |
| Malicious currency | Application factory pins deployed MockUSD; six decimals; exact incoming/outgoing balance deltas | Fee, false-return, revert, no-return and callback test currencies. Arbitrary rebasing/lying tokens remain unsupported |
| Unexpected donations | Demand/proceeds tracked separately from balances; payment inequality allows excess | Donated mUSD never becomes proceeds. No payment donation/foreign token/forced ETH sweep is provided; accidental donations may be stranded |
| Unbounded gas | No investor loops in finalisation, settlement, refunds, claims or proceeds withdrawal | Each operation handles one investor or fixed state; history and offering lists are paged off chain |
| Idle investors | Permissionless finalisation and settleFor; owner-only payouts | Another party can settle accounting, but cannot redirect refunds or tokens. Actual withdrawals still need the investor's key |
| Wrong issuer or asset | Factory checks original asset owner and current authorisation; offering issuer is immutable | Outsider, other-issuer and revoked-issuer tests |
| Wrong RPC/deployment | New subscription service checks factory/currency runtime hashes, deployment block and registry links through public and signing RPCs | Real-chain test rejects a mismatching signing provider before submission; trust in RPC honesty remains |

## Static analysis

Slither 0.11.6 analysed 33 contracts with 102 detectors using current Hardhat build artifacts. Test/dependency paths were filtered from reported findings, not claimed as unaudited production implementations. Final machine output: [slither-reviewed-results.json](evidence/subscription/slither-reviewed-results.json), `success: true`, 13 findings: 2 high, 3 medium, 6 low, 2 informational. CLI status 255 indicates findings, not compilation failure.

| Finding(s) | Assessment |
|---|---|
| arbitrary-send-erc20: AssetSale.allocate, SubscriptionOffering.depositOfferingTokens | False positives for arbitrary-source theft: source is immutable issuer, caller is issuer-only, destination is escrow, allowance is required. Subscription tests reject outsiders and missing allowance |
| incorrect-equality: three zero-amount recovery/sweep guards | Intended rejection of zero available amount; no fragile equality between external balance and liabilities |
| reentrancy-events: two existing AssetSale ETH payout paths | Event ordering warning, not demonstrated double payment. Existing withdrawal tests and unchanged source retained. New offering uses nonReentrant throughout |
| timestamp: constructor, state, deposit, finalise | Required subscription scheduling. No timestamp randomness, interest accrual or second-level fairness guarantee. Boundary tests cover start/end; block inclusion can affect last-minute availability |
| low-level-calls: two existing AssetSale ETH payout paths | Expected ETH transfers, with checked return values and accounting/role restrictions. New offering pays only ERC-20 currency |

An earlier scan flagged implicit zero initialization of the finalisation lower bound. It was safe Solidity default-zero behaviour, not a confirmed exploit. The code now explicitly assigns zero; the latest scan no longer flags it. The scan run overlapping artifact regeneration is retained separately and is not the final evidence. [build-source-check.json](evidence/subscription/build-source-check.json) matches current production/test sources to the compiler input. A stale pre-task build artifact referencing a removed helper initially prevented Slither parsing; cleaning generated artifacts and compiling the actual source corrected the scan setup.

## Genuine implementation and verification issues

1. **Legacy test matcher:** generated tests used `.reverted`, which this installed Hardhat matcher rejects. Replaced with `.revert(ethers)`; 16 initial harness failures are preserved. This was a validation-code defect, not a production contract vulnerability.
2. **Timestamp test assumption:** setting the next block timestamp did not advance the latest block when a rejected transaction stopped at estimation. The stage-read assertion failed. The test now mines at the deadline before checking the state. It does not treat a reverted estimate as a mined transaction.
3. **Frontend read regression:** the new marketplace section initially invoked the shared asset hook even when subscriptions were not configured, consuming an additional read and breaking an existing RPC-error/retry test. The disabled extension now returns before mounting its data-reading child. Original frontend suite returned to 118/118, and the expanded suite passes 131/131. This is the concrete compatibility defect found during integration.
4. **Test-harness override:** the initial adversarial asset tried to override a non-virtual AssetToken hook. The harness now implements a separate test-only compatible token; production AssetToken was not changed to accommodate a test.
5. **Type and JSX errors:** a generated JSX handler was missing a closing brace; a dynamic TypeChain interface overload required a generic ethers Interface. Both were caught by builds/typechecks and corrected. First failures remain in evidence.
6. **Coverage invocation:** `--no-compile --coverage` passed tests but produced an empty coverage report. The valid report uses compilation/instrumentation enabled; no zero-data run is represented as successful coverage.

Causes above are observable code/tool mismatches. No hidden AI reasoning or fabricated exploit is asserted. Additional review corrected an empty-history-page pagination cursor and reused provider-limit splitting. These were review refinements, not claimed as independently reproduced vulnerabilities.

## Limits and remaining acceptance

The conservative soft-cap rule can fail otherwise fundable offerings. Asset administrator recovery powers remain trusted. Unclaimed allocations never expire; refunds do not require token delivery. Unsupported tokens, key loss, off-chain custody/legal ownership, RPC dishonesty and production deployment governance are outside this proof of concept. The original direct-sale signing service is preserved; the stronger fingerprint checks described above apply to the new subscription service.

All observed tests pass; this is not a proof of absence of vulnerabilities. No new dependency was added. No real assets, backed stablecoins, mainnet transactions, live MetaMask acceptance or responsive-browser screenshots are claimed.
