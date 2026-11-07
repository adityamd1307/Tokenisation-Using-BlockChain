# SC4053 Blockchain Technology — Feature Enhancement: Institutional Primary Offering Engine

## PROJECT CONTEXT

We have developed an Ethereum-based decentralised application titled:

**Tokenisation of Real-World and Digital Assets on Ethereum**

This is our Bring Your Own Project (BYOP) submission for NTU's SC4053 Blockchain Technology Development Project.

Our existing platform supports:

- ERC-20 tokenisation of simulated real-world and digital assets.
- Authorised asset issuers.
- Asset factory and registry.
- Investor whitelisting and transfer restrictions.
- Fixed-price primary token purchases using ETH.
- Issuer management and investor dashboards.
- MetaMask wallet integration.
- Token transfers and transaction history.
- Smart-contract testing, security auditing and technical documentation.

We have completed the original development phases.

We now want to introduce a substantial enhancement:

# BUILD A COMPLETE SUBSCRIPTION-BASED PRIMARY OFFERING ENGINE

This should be a production-quality academic proof of concept demonstrating institutional-style primary issuance.

Instead of purchasing tokens immediately, investors commit a mock stablecoin during a subscription window.

At the end of the subscription period, the smart contract determines whether the offering succeeds, calculates token allocations, processes refundable balances through investor-initiated withdrawals, and allows eligible investors to claim their allocated asset tokens.

This is the highest-priority enhancement to the project.

**Implement the complete feature, integrate it with the existing application, write thorough automated tests, perform a security review and update the technical and AI audit documentation.**

Do not stop after planning.

---

# 1. FIRST INSPECT THE EXISTING REPOSITORY

Before modifying any code:

1. Read README.md.
2. Inspect the Solidity contracts.
3. Inspect AssetFactory, AssetToken and AssetSale.
4. Review the existing deployment scripts.
5. Inspect React frontend components.
6. Review contract ABIs and integration utilities.
7. Read existing test suites.
8. Read security audit findings.
9. Read the AI Audit Report.
10. Understand the current asset creation and primary issuance workflow.

Determine the actual versions of Solidity, OpenZeppelin, Hardhat, ethers.js and React.

Run the existing tests and build commands to establish a baseline.

Do not assume all contracts or functions have the same names as earlier project specifications.

Preserve existing functionality and avoid unnecessary architectural changes.

## Existing Compatibility Requirement

The current fixed-price ETH sale functionality may already work correctly.

Do not delete it or break existing users simply to implement the new subscription engine.

Prefer supporting two issuance mechanisms:

**Option A — Direct Fixed-Price Sale**

An approved investor pays ETH and receives tokens immediately.

**Option B — Subscription-Based Offering (NEW)**

An approved investor commits mock stablecoins, receives a calculated allocation after finalisation, withdraws any refund, and claims tokens.

The new subscription offering should be clearly identified as the more advanced primary-issuance mechanism.

Where the current architecture makes dual-mode integration impractical, implement the smallest safe migration and document the compatibility consequences.

---

# 2. DEFINE THE COMPLETE OFFERING LIFECYCLE

The new offering must support the following lifecycle.

```text
Issuer creates tokenised asset
              |
              v
Issuer configures primary offering
              |
              v
Issuer deposits token inventory
              |
              v
Subscription window opens
              |
              v
Investors commit mock stablecoins
              |
              v
Subscription window closes
              |
              v
Offering is finalised
              |
       +------+------+
       |             |
       v             v
   SUCCESS         FAILED
       |             |
       v             v
Pro-rata or       Full refunds
full allocation   available
       |
       v
Investors settle allocations
       |
       +----------------+
       |                |
       v                v
 Claim tokens      Withdraw refund
       |
       v
Issuer withdraws
earned proceeds
```

The contract must enforce its lifecycle using immutable parameters, timestamps and explicit state transitions.

No participant should be able to bypass the required stages.

---

# 3. IMPLEMENT A MOCK STABLECOIN

Create a mock ERC-20 stablecoin contract.

Suggested filename:

`contracts/MockUSD.sol`

## Requirements

Use OpenZeppelin ERC-20.

Suggested properties:

- Name: Mock USD
- Symbol: mUSD
- Decimals: 6
- Value convention: 1 mUSD represents 1 simulated USD
- Standard ERC-20 transfers and approvals

Example:

```text
1 mUSD = 1,000,000 base units

100 mUSD = 100,000,000 base units
```

## Minting

Provide a safe way to distribute test stablecoins to development wallets.

Prefer an owner-controlled mint function or a deployment script that allocates tokens to designated demo investors.

Do not introduce an unrestricted production-facing minting mechanism.

The currency must be explicitly labelled as a simulated stablecoin with no real monetary backing.

## Example Test Balances

```text
Investor A: 10,000 mUSD
Investor B: 10,000 mUSD
Investor C: 10,000 mUSD
Investor D: 10,000 mUSD
```

Ensure that the frontend displays the correct six-decimal amounts.

Do not confuse mock stablecoin base units with ETH wei.

---

# 4. IMPLEMENT THE PRIMARY OFFERING SMART CONTRACT

Create:

`contracts/SubscriptionOffering.sol`

This contract is the core of the new feature.

It must manage:

1. Subscription start and end times.
2. Offering inventory.
3. Soft cap and hard cap.
4. Investor stablecoin commitments.
5. Subscription finalisation.
6. Successful and failed offering outcomes.
7. Pro-rata allocation.
8. Investor refunds.
9. Token claims.
10. Issuer proceeds withdrawals.
11. Event logging and lifecycle state.

Use OpenZeppelin's established security utilities where appropriate.

---

# 5. OFFERING CONFIGURATION

Each subscription offering must have immutable economic parameters.

Suggested constructor configuration:

```solidity
struct OfferingConfig {
    address assetToken;
    address paymentToken;
    address issuer;
    uint256 tokenSupplyForSale;
    uint256 tokenPrice;
    uint256 softCap;
    uint256 hardCap;
    uint256 subscriptionStart;
    uint256 subscriptionEnd;
}
```

These are conceptual names. Adapt them to the existing code architecture.

## Parameters

**Asset Token**

The ERC-20 token issued by the existing asset-tokenisation system.

**Payment Token**

The mock stablecoin used for investor subscriptions.

**Issuer**

The authorised wallet managing the offering.

**Offered Token Supply**

The number of existing asset tokens allocated for subscription.

**Token Price**

The fixed stablecoin price for one asset-token unit.

**Soft Cap**

The minimum accepted funding required for a successful offering.

**Hard Cap**

The maximum accepted funding.

**Subscription Start**

The timestamp after which commitments become possible.

**Subscription End**

The timestamp after which new commitments are rejected.

## Validation

Require:

- Nonzero token addresses.
- Valid deployed token contracts.
- Nonzero issuer.
- Positive offered supply.
- Positive unit price.
- Positive soft cap.
- Hard cap greater than or equal to soft cap.
- Valid start/end timestamps.
- A future subscription end at deployment.
- No invalid arithmetic or incompatible token units.

For the MVP, enforce:

`hardCap = tokenSupplyForSale × tokenPrice`

This makes the maximum accepted funding consistent with the available token supply.

If the existing platform uses zero-decimal asset tokens, preserve that convention.

The token price must be denominated in the payment token's smallest units.

For example:

```text
Asset token supply: 1,000 CPT
Price per CPT: 2 mUSD

Hard Cap: 2,000 mUSD
Soft Cap: 1,200 mUSD
```

## Important Economic Definitions

- Total committed: all stablecoins deposited by investors.
- Hard cap: maximum stablecoins ultimately accepted.
- Allocation: token units assigned to an investor.
- Accepted payment: allocation multiplied by token price.
- Refund: committed amount minus accepted payment.
- Issuer proceeds: aggregate accepted payments, not gross commitments.

The final implementation must never confuse gross subscriptions with earned proceeds.

---

# 6. OFFERING INVENTORY

Before investors can subscribe, the issuer must fund the offering with asset tokens.

Implement an issuer-only inventory deposit function such as:

`depositOfferingTokens(uint256 amount)`

Requirements:

1. Only the designated issuer can deposit inventory through this function.
2. The asset-token contract must approve the offering contract as an eligible token holder.
3. The issuer must grant the appropriate ERC-20 spending allowance.
4. The offering contract transfers the tokens into escrow.
5. Deposits must be validated against the configured offering supply.
6. New deposits must be prohibited after the offering has started.
7. An offering must be fully funded before accepting commitments.

Use SafeERC20 and validate the actual amount received.

Do not mint extra asset tokens for the offering.

The token inventory must come from the already-existing fixed supply.

Do not bypass the existing investor-whitelist logic.

---

# 7. SUBSCRIPTION WINDOW

Implement time-controlled investor subscriptions.

An offering should conceptually progress through:

```text
SCHEDULED
    |
    v
SUBSCRIPTION OPEN
    |
    v
SUBSCRIPTION CLOSED
    |
    v
FINALIZED SUCCESS / FINALIZED FAILURE
```

The contract should enforce the time boundaries using `block.timestamp`.

Use explicit finalisation state to prevent repeated finalisation.

Do not depend on a background server to close the offering automatically. Once the end timestamp has passed, the contract must reject new commitments even if nobody has called finalise.

A successful finalisation transaction should only be possible after the subscription period ends.

For local demonstrations, use a short subscription window, such as 2–5 minutes.

For production-style configuration, allow a longer window.

Do not use insecure timestamp assumptions requiring second-level precision from Ethereum block producers.

---

# 8. INVESTOR STABLECOIN COMMITMENTS

Implement a function conceptually equivalent to:

`commit(uint256 amount)`

## Expected Workflow

1. Investor connects MetaMask.
2. Investor selects an active offering.
3. Investor enters the amount of mUSD to commit.
4. Frontend checks eligibility.
5. Investor approves the offering contract to spend mUSD.
6. Investor submits a commitment transaction.
7. Smart contract transfers mUSD into escrow.
8. Investor's commitment balance is recorded.
9. Total commitments increase.
10. A subscription event is emitted.

## Smart Contract Requirements

Reject commitments when:

- Offering has not started.
- Offering has ended.
- Offering inventory is not fully funded.
- Investor is not whitelisted for the asset.
- Amount is zero.
- Investor has insufficient mUSD.
- ERC-20 allowance is insufficient.
- Payment token transfer fails.

For simplicity and to avoid fractional token dust during ordinary under-subscription, require each commitment amount to be an exact multiple of the fixed token price.

Allow an investor to increase an existing commitment through multiple transactions during the subscription window.

Record:

```solidity
mapping(address => uint256) public commitments;
```

Track:

- Total stablecoins committed.
- Number of distinct subscribers.
- Commitment amount per investor.

Emit an event similar to:

`SubscriptionCommitted(investor, amount, totalInvestorCommitment)`

## Crucial Requirement: Oversubscription

**Do not reject subscriptions merely because total commitments exceed the hard cap.**

Oversubscription is an intended feature.

For example:

```text
Hard Cap: 2,000 mUSD

Investor A: 1,800 mUSD
Investor B: 1,400 mUSD
Investor C:   800 mUSD

Total Committed: 4,000 mUSD
```

All three subscriptions should be accepted during the valid window, assuming all other requirements are satisfied.

The contract must determine the final allocation only after the subscription window closes.

The hard cap limits the amount ultimately retained by the offering, not gross escrowed deposits.

---

# 9. SOFT CAP AND OFFERING FINALISATION

Implement:

`finalizeOffering()`

Finalisation should be callable after the subscription deadline.

It must be impossible to finalise twice.

## Failure Case

If the offering cannot meet its defined soft-cap condition, it fails.

Requirements:

- No investor receives an asset-token allocation.
- All committed stablecoins become refundable.
- Issuer cannot withdraw investor subscription funds.
- Token inventory remains recoverable by the issuer, subject to the asset's compliance restrictions.
- Failure state is permanent.
- Appropriate events are emitted.

## Success Case

If the offering meets the soft-cap requirement:

- Determine whether it is undersubscribed or oversubscribed.
- Establish the allocation denominator.
- Establish the final maximum allocation.
- Enable individual investor settlement.
- Enable token claims and refund withdrawals.
- Permit issuer withdrawal of legitimately earned proceeds only.

## Critical Soft-Cap Accounting Requirement

The soft cap must represent a genuine fundraising threshold, not a misleading gross-demand figure.

Because integer rounding in oversubscribed offerings can leave some tokens unallocated, gross commitments and actual accepted proceeds may differ.

Design an explicit, mathematically justified approach to ensure that a successful offering meets the stated minimum accepted funding.

A conservative lower bound on total accepted proceeds is acceptable if the implementation documents why it is safe. A bounded or multi-step settlement mechanism is also acceptable if it remains gas-safe and deterministic.

Do not simply treat gross commitments above the soft cap as proof of sufficient net proceeds without analysing the rounding implications.

Document the selected rule and its trade-offs.

---

# 10. PRO-RATA ALLOCATION ENGINE

This is the most important technical component.

Implement deterministic proportional allocation when an offering is oversubscribed.

## Allocation Rule

If total demand does not exceed the hard cap:

Each investor receives the quantity of tokens corresponding to their full valid commitment.

If total demand exceeds the hard cap:

Token allocations are proportional to each investor's committed stablecoin amount.

Conceptually:

`allocation = floor(investorCommitment × offeredTokenSupply / totalCommitments)`

The calculation must use Solidity integer arithmetic.

Adjust the formula as necessary for the exact asset-token units and the final economic specification.

## Example: Oversubscribed Offering

```text
Asset: Campus Property Token
Offered Supply: 1,000 CPT
Token Price: 2 mUSD
Soft Cap: 1,200 mUSD
Hard Cap: 2,000 mUSD

Investor Commitments:
A: 1,800 mUSD
B: 1,400 mUSD
C:   800 mUSD

Total: 4,000 mUSD
```

Demand is 200% of the hard cap.

Expected allocations:

| Investor | Commitment | Allocation | Accepted Payment | Refund |
|---|---:|---:|---:|---:|
| A | 1,800 mUSD | 450 CPT | 900 mUSD | 900 mUSD |
| B | 1,400 mUSD | 350 CPT | 700 mUSD | 700 mUSD |
| C | 800 mUSD | 200 CPT | 400 mUSD | 400 mUSD |
| Total | 4,000 mUSD | 1,000 CPT | 2,000 mUSD | 2,000 mUSD |

Verify that these results are obtained from actual contract calculations, not hardcoded demo logic.

## Rounding Rules

Ethereum does not support floating-point arithmetic in Solidity.

The implementation must address:

- Integer division.
- Truncation.
- Unequal investor allocations.
- Small subscriptions.
- Rounding dust.
- Unallocated token units.
- Refund remainders.
- Preservation of the hard cap.

For the MVP, using floor-based allocations is acceptable.

Any remaining unallocated asset tokens should remain accounted for and may be recovered by the issuer only when doing so cannot invalidate outstanding investor claims.

Do not distribute leftover tokens based on who claims first.

Do not make allocation depend on transaction ordering after finalisation.

If fair largest-remainder allocation would require unbounded loops, prefer a documented deterministic floor rule rather than implementing an unsafe on-chain enumeration algorithm.

## Mandatory Invariants

Enforce and test:

1. Every allocation is nonnegative.
2. An investor's accepted payment never exceeds their commitment.
3. Total allocated tokens never exceed the offered supply.
4. Total accepted payments never exceed the hard cap.
5. Refunds are never negative.
6. Per investor: accepted payment + refund = original commitment.
7. Pro-rata outcomes do not depend on claim ordering.
8. Final allocations cannot change after finalisation.

Use overflow-safe multiplication/division.

Where appropriate, use a well-reviewed `mulDiv` implementation compatible with the existing OpenZeppelin version.

Do not introduce JavaScript floating-point arithmetic into financial calculations.

---

# 11. GAS-SAFE ALLOCATION AND SETTLEMENT

Avoid unbounded loops over all investors in a single finalisation transaction.

The offering must be scalable beyond a handful of classroom demo wallets.

Prefer:

1. O(1) offering finalisation.
2. Immutable finalisation parameters.
3. Per-investor allocation calculated lazily.
4. Per-investor settlement initiated individually.
5. No global loop that transfers funds to every subscriber.

Implement a clearly defined investor-settlement mechanism.

Suggested function:

`settleSubscription()`

This should:

- Confirm the offering is finalised.
- Calculate the investor's allocation and refund.
- Store the final entitlement.
- Mark the subscription as settled.
- Prevent duplicate settlement.
- Account for the portion legitimately earned by the issuer.
- Record refundable stablecoins as an investor credit.

For failed offerings, the allocation must be zero and the full commitment must become refundable.

Avoid combining accounting settlement with mandatory outbound transfers where doing so would unnecessarily prevent investors from accessing their refunds.

**Important:** If an investor is removed from the asset whitelist after subscribing, this may prevent token delivery. It must not prevent them from recovering their refundable stablecoins.

The settlement, refund, and token-claim operations must be sufficiently independent to handle this case safely.

---

# 12. PULL-BASED REFUNDS

Implement:

`withdrawRefund()`

Do not automatically loop over investors and transfer refunds during finalisation.

Every investor must actively withdraw their own refundable mUSD balance.

## Required Behaviour

On a successful oversubscribed offering:

- Investor receives a partial refund based on their final allocation.

On a successful undersubscribed offering:

- Investor receives no refund if their entire valid commitment is accepted.

On a failed offering:

- Investor can recover the full commitment.

For example:

```text
Investor A committed: 1,800 mUSD
Accepted payment: 900 mUSD

Refund entitlement: 900 mUSD
```

Investor A calls `withdrawRefund()`.

The contract transfers 900 mUSD to Investor A.

The refund balance is then zero.

A second attempt to withdraw the same refund must fail or have no effect according to the documented interface.

## Security Requirements

Use:

- Checks-effects-interactions.
- Reentrancy protection.
- SafeERC20.
- Internal accounting of refundable credits.
- Protection against duplicate withdrawals.

Do not let issuer withdrawals consume funds reserved for investor refunds.

## Required Tests

- Successful partial refund.
- Full refund after failed offering.
- Zero refund.
- Repeated refund attempt.
- Refund after investor-whitelist revocation.
- Refund remains available if the investor has not claimed tokens.
- Refund to contract-based investors where applicable.
- Malicious callback/reentrancy scenarios where meaningful.

Test accounting conservation after every refund.

---

# 13. INVESTOR TOKEN CLAIMS

Implement:

`claimTokens()`

After a successful offering, investors should be able to claim their final token allocation.

## Required Behaviour

1. Offering must be successfully finalised.
2. The investor must have a positive allocation.
3. The allocation must not have already been claimed.
4. The investor must be eligible to receive the asset token at claim time.
5. The offering contract transfers the allocated tokens.
6. The investor's claimed state is updated.
7. A claim event is emitted.

Example:

```text
Investor A commitment: 1,800 mUSD

Final allocation: 450 CPT

Investor calls claimTokens()

Investor receives 450 CPT
```

## Important Cases

- Investors cannot claim before finalisation.
- Failed offerings never distribute tokens.
- Investors cannot claim twice.
- Investors cannot claim another person's entitlement.
- Whitelist rules remain enforced.
- Claiming tokens must not automatically consume or erase a pending stablecoin refund.
- Withdrawing a refund must not erase the investor's valid token allocation.

A revoked investor may be unable to receive asset tokens, but they must not lose unrelated refundable stablecoins.

Document how unclaimed token entitlements are handled. Do not silently confiscate them or implement arbitrary claim expiry without a clearly justified policy.

---

# 14. ISSUER PROCEEDS ACCOUNTING

The issuer must only be able to withdraw genuinely accepted payment amounts.

Implement a function such as:

`withdrawProceeds()`

For a successful offering:

- Accepted payments become issuer proceeds only when the corresponding settlement has been safely accounted for.
- Investor refund obligations remain protected.
- Withdrawals may occur incrementally as settlements are processed.
- The contract must prevent the issuer from extracting unsettled investor deposits.
- The amount withdrawn must never exceed recorded earned proceeds.

For a failed offering:

- Issuer proceeds must be zero.
- Issuer cannot withdraw subscriber deposits.
- All committed stablecoins must remain refundable.

## Solvency Requirements

Define explicit accounting variables for:

- Total commitments.
- Settled commitments.
- Refund credits.
- Refunds already paid.
- Recognised issuer proceeds.
- Proceeds already withdrawn.

At every state transition, verify that the contract holds enough payment tokens to satisfy all outstanding investor obligations.

Do not assume that the hard cap can be withdrawn immediately after finalisation.

**This is especially important in oversubscribed offerings with integer rounding.**

The contract may ultimately accept less than the hard cap because some fractional allocations were rounded down.

Issuer withdrawals must be based on actual accepted payment accounting.

If users have not yet settled their subscriptions, their funds must remain safely escrowed.

---

# 15. OFFERING FINALISATION AND UNSOLD TOKEN RECOVERY

Implement secure recovery of remaining asset-token inventory.

For failed offerings:

The issuer should be able to recover the offered tokens, provided the transfer is permitted by the asset token's compliance logic.

For successful offerings:

The offering contract must preserve every outstanding investor token entitlement.

Only unallocated and genuinely unencumbered tokens may be recovered.

Do not allow the issuer to recover tokens that investors are still entitled to claim.

## Rounding Dust

Consider an example:

```text
Offered tokens: 7
Three investors commit equally
Total demand exceeds 7 token units
```

Each investor may receive two tokens after floor-based pro-rata allocation.

One token remains unallocated.

The system must account for that token without allocating it arbitrarily or making claims order-dependent.

If safe immediate recovery cannot be established, keep the remaining token securely reserved until the necessary settlement conditions are met.

Document the approach.

Do not recover inventory based solely on the offering's total token balance without considering outstanding claims.

---

# 16. INTEGRATE WITH ASSETFACTORY AND ASSET REGISTRY

The existing system currently deploys or registers tokenised assets with a fixed-price sale mechanism.

Extend it to support subscription offerings.

Preferred architecture:

```text
AssetFactory
    |
    +---- AssetToken
    |
    +---- Direct AssetSale (existing)
    |
    +---- SubscriptionOffering (new)
                  |
                  +---- MockUSD
```

If a dedicated subscription factory is cleaner and safer, it may be introduced.

However:

- Reuse the existing AssetToken.
- Reuse existing compliance logic.
- Preserve asset IDs and registry compatibility.
- Avoid breaking existing frontend ABI usage.
- Prevent the same offering inventory from being committed to two sale mechanisms simultaneously.
- Explicitly distinguish direct sales from subscription sales.

For each subscription offering, the application should be able to retrieve:

- Offering address.
- Asset token address.
- Stablecoin address.
- Issuer.
- Unit price.
- Offered supply.
- Soft cap.
- Hard cap.
- Subscription start/end.
- Current commitments.
- Offering state.

The issuer should be able to create a subscription offering without manually deploying contracts through a terminal.

Ensure that factory-deployed offerings correctly assign permissions to the designated issuer rather than the factory.

---

# 17. FRONTEND — PRIMARY OFFERING DASHBOARD

Integrate the feature into the existing React interface.

Do not create an unrelated standalone frontend.

Maintain the existing design system and improve it where necessary.

## 17.1 Marketplace

Clearly distinguish:

**Direct Sale**

Buy tokens immediately.

**Subscription Offering**

Commit stablecoins and receive an allocation after finalisation.

Use appropriate status labels:

- Upcoming.
- Subscription Open.
- Awaiting Finalisation.
- Successful.
- Failed.

Do not label an offering successful solely because its gross commitments exceeded the soft cap.

## 17.2 Offering Details Page

Display:

- Asset name and symbol.
- Offering type.
- Price per token.
- Mock stablecoin used.
- Offered token supply.
- Soft cap.
- Hard cap.
- Total subscriptions.
- Funding progress.
- Subscription deadline.
- Connected investor's commitment.
- Final allocation, when available.
- Refund entitlement, when available.
- Claim status.

Show an appropriate warning that the assets and stablecoin are simulated.

## 17.3 Funding Progress Visualisation

Add a high-quality progress graphic illustrating:

- Soft-cap threshold.
- Hard-cap threshold.
- Total investor demand.
- Oversubscription percentage.

Example:

```text
Soft Cap: 1,200 mUSD
Hard Cap: 2,000 mUSD

Total Subscribed: 4,000 mUSD

Subscription Demand: 200% of hard cap
```

The graphic must distinguish demand from accepted proceeds.

Do not visually cap the subscription progress at 100% without also displaying the true oversubscription level.

## 17.4 Subscription Interface

Provide a form:

```text
Commit to Offering

Available mUSD: 5,000

Commitment Amount:
[1,800]

Payment Token: mUSD

[Approve mUSD]
[Commit Stablecoins]
```

Implement the two separate blockchain transactions:

1. ERC-20 approval.
2. Subscription commitment.

Do not claim they are atomic.

Display:

- Wallet confirmation.
- Pending transaction.
- Transaction hash.
- Confirmed status.
- Updated commitment.

Use precise BigInt-safe financial calculations.

## 17.5 Allocation Dashboard

After finalisation, show:

```text
Your Subscription

Committed: 1,800 mUSD

Final Allocation: 450 CPT

Accepted Payment: 900 mUSD

Refund Available: 900 mUSD
```

Provide actions:

- Settle Subscription, when needed.
- Withdraw Refund.
- Claim Allocated Tokens.

Actions must be disabled or explained when the offering is in an incompatible state.

## 17.6 Issuer Offering Management

Add an issuer-facing interface allowing:

- Create subscription offering.
- Configure caps and dates.
- Deposit token inventory.
- View subscription demand.
- View number of subscribers.
- View funding progress.
- Finalise offering.
- View outcome.
- View recognised proceeds.
- Withdraw earned proceeds.
- Recover available unallocated tokens.

Only show issuer-specific actions to wallets with appropriate permissions.

The contract must enforce security independently of the UI.

## 17.7 Transaction History

Include events such as:

- OfferingCreated.
- SubscriptionCommitted.
- OfferingFinalized.
- AllocationSettled.
- RefundWithdrawn.
- TokensClaimed.
- ProceedsWithdrawn.

Use the actual events defined by the final implementation.

Avoid counting a stablecoin approval as an investment or a refund as an additional purchase.

---

# 18. FRONTEND USER EXPERIENCE

Design the new pages to match the existing institutional-finance interface.

Prioritise visual quality.

Use:

- Clear progress bars.
- Funding threshold markers.
- Countdown or subscription deadline indicators.
- Investor allocation cards.
- Refund summary cards.
- Sale outcome status.
- Transaction history.
- Responsive layouts.

Example offering card:

```text
CAMPUS PROPERTY TOKEN

Institutional Subscription Offering

Token Price: 2 mUSD
Offered Supply: 1,000 CPT

Soft Cap: 1,200 mUSD
Hard Cap: 2,000 mUSD

Total Demand: 4,000 mUSD
Oversubscribed: 200%

Status: Successful

[View Allocation]
```

Avoid fabricated charts or performance claims.

Do not imply that an oversubscribed offering guarantees an investment return.

---

# 19. AUTOMATED TESTING — MANDATORY

Create comprehensive tests for the new offering engine.

Suggested files:

```text
test/
├── MockUSD.test.js
├── SubscriptionOffering.test.js
├── SubscriptionAllocation.test.js
├── SubscriptionRefunds.test.js
├── SubscriptionClaims.test.js
├── SubscriptionSecurity.test.js
└── SubscriptionIntegration.test.js
```

Adapt filenames to the existing test framework.

## Test Group A — Offering Creation

Verify:

1. Correct issuer.
2. Correct asset token.
3. Correct payment token.
4. Correct offering supply.
5. Correct price.
6. Correct soft cap.
7. Correct hard cap.
8. Valid subscription timestamps.
9. Invalid configurations revert.
10. Unauthorised issuers cannot create offerings.

## Test Group B — Subscription Window

Verify:

1. Commitment before start reverts.
2. Commitment during the valid window succeeds.
3. Commitment at or after the deadline reverts.
4. Only whitelisted investors may commit.
5. Invalid amounts revert.
6. Multiple commitments accumulate.
7. Insufficient stablecoin allowance reverts.
8. Unfunded offerings reject commitments.
9. Invalid stablecoin transfers revert.
10. Total commitments are recorded correctly.

## Test Group C — Undersubscribed Success

Example:

```text
Soft Cap: 1,200 mUSD
Hard Cap: 2,000 mUSD

Total Committed: 1,400 mUSD
```

Expected:

- Offering succeeds.
- Investors receive full token allocations.
- Accepted proceeds equal 1,400 mUSD.
- No unnecessary refunds.
- Unallocated inventory remains recoverable under safe rules.

## Test Group D — Soft-Cap Failure

Example:

```text
Soft Cap: 1,200 mUSD
Total Committed: 700 mUSD
```

Expected:

- Offering fails.
- No asset tokens allocated.
- Investors recover 100% of commitments.
- Issuer cannot withdraw subscription funds.
- Asset inventory can be recovered safely.

## Test Group E — Oversubscription

Use:

```text
Offered Supply: 1,000 CPT
Price: 2 mUSD
Hard Cap: 2,000 mUSD

A commits: 1,800 mUSD
B commits: 1,400 mUSD
C commits:   800 mUSD

Total: 4,000 mUSD
```

Verify:

- A receives 450 CPT.
- B receives 350 CPT.
- C receives 200 CPT.
- Accepted payment totals 2,000 mUSD.
- Refunds total 2,000 mUSD.
- No more than 1,000 tokens are distributed.
- Total accounting is conserved.

## Test Group F — Rounding Edge Cases

Test:

- Three investors competing for seven tokens.
- Unequal fractional allocations.
- Very small commitments.
- A subscriber receiving zero tokens due to floor rounding.
- Large commitments.
- Multiple top-ups.
- Different settlement ordering.
- Remaining token dust.
- Stablecoin base-unit precision.
- Integer multiplication near relevant numeric limits.
- Rounding effects on the soft-cap success condition.

Ensure no claims or refunds depend on transaction ordering.

## Test Group G — Refunds

Test:

1. Full refund after offering failure.
2. Partial refund after oversubscription.
3. No refund when fully allocated.
4. Double-refund prevention.
5. Refund following whitelist revocation.
6. Refund independently of token claim.
7. Issuer cannot withdraw refundable balances.
8. Failed stablecoin transfer does not corrupt accounting.

## Test Group H — Token Claims

Test:

1. Claim before finalisation fails.
2. Claim after successful finalisation succeeds.
3. Claim after failed offering fails.
4. Claim twice fails.
5. Claim for another investor fails.
6. Unapproved recipient cannot receive restricted asset tokens.
7. Token balances update correctly.
8. Refunding does not erase token entitlement.
9. Claiming does not erase refund entitlement.
10. Unclaimed token obligations remain protected.

## Test Group I — Security

Test:

- Unauthorised finalisation where prohibited.
- Unauthorised issuer withdrawals.
- Reentrancy attempts.
- Repeated settlement.
- Stablecoin escrow accounting.
- Insufficient reserves.
- Malicious or incompatible token behaviour.
- Wrong token address.
- Unauthorized token recovery.
- Cross-offering state isolation.
- Contract-based investors.
- Timestamp boundary conditions.

## Test Group J — Existing Functionality

Run all earlier tests.

The introduction of subscription offerings must not break:

- AssetToken.
- AssetFactory.
- Existing direct AssetSale.
- Whitelisting.
- Investor portfolios.
- Direct purchases.
- Asset registration.

---

# 20. PROPERTY-BASED AND INVARIANT TESTING

Where practical, add property-based testing.

Focus on mathematically meaningful invariants.

## Allocation Conservation

`sum(allocatedTokens) <= offeredTokenSupply`

## Funding Limit

`sum(acceptedPayments) <= hardCap`

## Commitment Accounting

For every investor:

`commitment = acceptedPayment + refundableAmount`

## Refund Protection

The contract must always retain enough stablecoins to honour outstanding refunds and unsettled deposits.

## Claims

Each investor can obtain no more than their final entitlement.

## Proceeds

Issuer withdrawals cannot exceed earned and recognised proceeds.

## State Finality

No new commitments or changes to final allocation parameters after offering finalisation.

## Order Independence

Investor A must receive the same allocation whether they settle first or last.

Use realistic bounded actor sets when testing aggregate invariants.

Do not claim formal mathematical proof merely from passing test cases.

---

# 21. SECURITY AUDIT — HIGH PRIORITY

This feature introduces new risks that must be evaluated rigorously.

Audit at least:

## Reentrancy

- Stablecoin refunds.
- Token claims.
- Issuer withdrawals.
- Token recovery.
- External token interactions.

## Rounding Attacks

- Integer division.
- Tiny subscriptions.
- Manipulation of participant count.
- Unequal allocations.
- Rounding dust.
- Claimed versus unclaimed inventory.

## Economic Manipulation

- Oversubscription.
- Commitment splitting across wallets.
- Last-minute subscriptions.
- Attempted soft-cap manipulation.
- Repeated commitments.
- Refund accounting.
- Issuer attempts to withdraw escrow prematurely.

## Access Control

- Offering creation.
- Offering configuration.
- Finalisation.
- Withdrawal.
- Inventory recovery.
- Asset token compliance.

## Denial of Service

- Excessive subscriber counts.
- Unbounded settlement loops.
- Large event queries.
- Investors unable to claim because of revoked eligibility.
- Incompatible token contracts.
- Malicious token transfer behaviour.

## Stablecoin Risks

- Incorrect decimal handling.
- False assumptions about ERC-20 transfer behaviour.
- Fee-on-transfer tokens.
- Malicious callback tokens.
- Unexpected token donations.
- Incorrect accounting of contract balances.

For the MVP, it is acceptable to explicitly support only the trusted MockUSD token and reject unsupported payment-token behaviour.

---

# 22. AI AUDIT REPORT ENHANCEMENT

Update the existing SC4053 AI Audit Report to include the new subscription engine.

The report must contain genuine evidence of development and review.

Focus particularly on:

1. Why the subscription architecture was chosen.
2. How soft cap and hard cap were defined.
3. Why commitments are escrowed.
4. Why oversubscription requires post-window allocation.
5. Why pull-based refunds are safer than unbounded push refunds.
6. How integer rounding affects financial allocations.
7. How reentrancy was prevented.
8. How the issuer's proceeds are separated from investor liabilities.
9. How the contract avoids unbounded loops.
10. What bugs or incorrect AI-generated designs were discovered.
11. What refinements were made.
12. Which tests prove the revised implementation works.

For every confirmed major issue, follow the assignment's required format:

- Why AI made the mistake, where the cause can be supported.
- Why the issue is problematic.
- How it was fixed.
- Evidence that the fix works.

Do not invent security vulnerabilities to make the report appear stronger.

Preserve relevant prompt logs and test evidence.

---

# 23. COMPLETE DEMONSTRATION SCENARIO

Create a reproducible local demonstration script.

Suggested file:

`scripts/demoSubscriptionOffering.js`

The script must execute the real contract functionality.

## Demonstration Setup

```text
Asset:
Campus Property Token

Symbol:
CPT

Total Asset Supply:
10,000 CPT

Tokens Offered:
1,000 CPT

Payment Token:
Mock USD (mUSD)

Price:
2 mUSD per CPT

Soft Cap:
1,200 mUSD

Hard Cap:
2,000 mUSD
```

## Participants

```text
Wallet A: Platform Administrator
Wallet B: Asset Issuer
Wallet C: Investor 1
Wallet D: Investor 2
Wallet E: Investor 3
Wallet F: Unapproved Investor
```

## Demonstration Part A — Setup

1. Deploy the MockUSD token.
2. Deploy or reuse the existing asset factory.
3. Authorise the issuer.
4. Create Campus Property Token.
5. Deploy/register its subscription offering.
6. Whitelist the offering contract.
7. Deposit 1,000 CPT.
8. Allocate mock stablecoins to investors.
9. Whitelist the three eligible investors.

## Demonstration Part B — Subscriptions

During the window:

```text
Investor 1 commits 1,800 mUSD
Investor 2 commits 1,400 mUSD
Investor 3 commits   800 mUSD
```

Expected total:

`4,000 mUSD`

The contract must accept subscriptions above the hard cap.

## Demonstration Part C — Finalisation

Advance the local blockchain timestamp beyond the subscription end.

Call `finalizeOffering()`.

Expected:

```text
Offering Status: SUCCESSFUL

Oversubscription: 200%

Accepted Funding: 2,000 mUSD

Refund Entitlement: 2,000 mUSD
```

If any of these values are lazily calculated rather than stored globally, explain how the demo derives or verifies them.

## Demonstration Part D — Allocation and Refunds

Expected individual results:

```text
Investor 1:
450 CPT allocation
900 mUSD accepted
900 mUSD refund

Investor 2:
350 CPT allocation
700 mUSD accepted
700 mUSD refund

Investor 3:
200 CPT allocation
400 mUSD accepted
400 mUSD refund
```

Each investor settles their subscription and independently withdraws their refund.

Verify the actual balance changes.

## Demonstration Part E — Claims

All three investors claim their allocated tokens.

Expected distributed tokens:

`1,000 CPT`

Ensure total asset supply remains unchanged.

## Demonstration Part F — Issuer Withdrawal

Issuer withdraws the accepted proceeds.

Expected:

`2,000 mUSD`

Verify that refunds were not consumed by issuer withdrawals.

## Demonstration Part G — Failed Offering

Create a second offering with:

```text
Soft Cap: 1,200 mUSD
Total Commitments: 700 mUSD
```

Finalise it after the window.

Expected:

- Offering fails.
- Investors can reclaim all 700 mUSD.
- No asset tokens are distributed.
- Issuer cannot withdraw these funds.
- Token inventory remains recoverable under the defined rules.

## Demonstration Part H — Security Checks

Demonstrate:

- Unapproved investor commitment rejected.
- Commitment after subscription closes rejected.
- Double claim rejected.
- Double refund rejected.
- Unauthorised withdrawal rejected.
- Total allocations never exceed offering supply.
- Stablecoin accounting remains solvent.

Print a structured summary of all results.

The script must exit with an error if any expected invariant fails.

---

# 24. DOCUMENTATION

Create or update:

```text
docs/
├── subscription-offering-specification.md
├── subscription-offering-architecture.md
├── subscription-allocation-mathematics.md
├── subscription-security-analysis.md
├── subscription-testing-results.md
└── AI_Audit_Report.md
```

Include:

- Contract architecture.
- Offering lifecycle diagram.
- Soft/hard cap definitions.
- Stablecoin payment accounting.
- Pro-rata formulas.
- Rounding examples.
- Refund and claim flow.
- Contract function documentation.
- Frontend integration.
- Security threat model.
- Test coverage.
- Actual implementation results.
- Limitations and assumptions.

Update README.md with instructions for the new offering engine.

If the existing presentation includes a fixed-price purchase demonstration, identify the slides that should be updated to accurately represent the newly implemented subscription lifecycle. Do not fabricate presentation results.

---

# 25. FINAL ACCEPTANCE CRITERIA

Do not declare the enhancement complete until the following are validated.

## Smart Contracts

- [ ] MockUSD works with six decimals.
- [ ] Offerings can be configured.
- [ ] Valid start/end times are enforced.
- [ ] Offering inventory is safely escrowed.
- [ ] Only approved investors may subscribe.
- [ ] Subscriptions use mock stablecoin.
- [ ] Commitments can exceed the hard cap.
- [ ] Total demand is tracked accurately.
- [ ] Soft-cap failure is handled correctly.
- [ ] Successful offerings can be finalised.
- [ ] Pro-rata allocation works.
- [ ] Integer rounding is explicitly handled.
- [ ] Accepted payments never exceed hard cap.
- [ ] Token allocations never exceed supply.
- [ ] Investors can settle entitlements.
- [ ] Refunds use the pull-payment pattern.
- [ ] Refunds cannot be withdrawn twice.
- [ ] Investors can claim asset tokens.
- [ ] Claims cannot be repeated.
- [ ] Claims remain independent of refunds.
- [ ] Issuer proceeds exclude refundable liabilities.
- [ ] Unallocated inventory recovery is safe.
- [ ] Existing whitelist enforcement remains intact.

## Frontend

- [ ] Marketplace supports subscription offerings.
- [ ] Issuer can create and configure offerings.
- [ ] Issuer can fund token inventory.
- [ ] Investors can approve mock stablecoin.
- [ ] Investors can commit funds.
- [ ] Funding progress is displayed.
- [ ] Soft and hard caps are visible.
- [ ] Oversubscription is displayed clearly.
- [ ] Offering can be finalised.
- [ ] Investors can view allocation.
- [ ] Investors can withdraw refunds.
- [ ] Investors can claim tokens.
- [ ] Issuers can withdraw earned proceeds.
- [ ] Transaction status and errors are handled.
- [ ] UI remains responsive and visually consistent.

## Validation

- [ ] Existing tests still pass.
- [ ] New offering tests pass.
- [ ] Oversubscription scenario passes.
- [ ] Failed offering refunds pass.
- [ ] Rounding edge cases pass.
- [ ] Reentrancy and accounting tests pass.
- [ ] Full demonstration script passes.
- [ ] No unresolved critical security defects remain.
- [ ] Documentation reflects actual functionality.
- [ ] AI Audit Report includes the new feature and genuine test evidence.

---

# 26. EXPECTED FINAL CODEX RESPONSE

After implementing and testing, provide:

### 1. Architecture Summary

Explain the new contracts and integration with the existing platform.

### 2. Files Created or Modified

List each file and its purpose.

### 3. Offering Lifecycle

Describe how subscriptions, finalisation, allocations, refunds, claims and proceeds work.

### 4. Allocation Mathematics

Show the actual formulas, integer rounding method, and how soft/hard cap requirements are maintained.

### 5. Security Analysis

Summarise reentrancy protection, access control, refund solvency, rounding risks and gas scalability.

### 6. Test Results

Include the actual commands executed and passing/failing test counts.

### 7. Demonstration Results

Show the executed oversubscription and failed-offering scenarios with actual final balances.

### 8. AI Audit Findings

Describe genuine issues discovered, corrections made and validation evidence.

### 9. Existing System Compatibility

Confirm whether the original asset-tokenisation workflow and direct-sale functionality remain operational.

### 10. Completion Status

Clearly identify completed and incomplete acceptance criteria.

---

# FINAL IMPLEMENTATION INSTRUCTIONS

- Inspect the existing repository first.
- Preserve completed project functionality.
- Implement the new offering engine rather than simply writing a design document.
- Follow the actual Solidity and frontend versions installed.
- Use OpenZeppelin libraries where appropriate.
- Avoid unbounded loops in finalisation, refunds or claims.
- Use exact integer arithmetic for all monetary calculations.
- Ensure hard-cap oversubscription is genuinely supported.
- Protect investor funds against premature issuer withdrawal.
- Make refund and token claims separate operations.
- Do not bypass asset-token whitelist restrictions.
- Write meaningful automated security and accounting tests.
- Use test-generated evidence rather than hardcoded demonstration outputs.
- Run all tests, builds and demonstration scripts.
- Update the AI Audit Report with genuine findings.
- Document any design trade-offs.
- Do not fabricate test results or vulnerabilities.
- Do not make Git commits unless explicitly requested.
- Do not deploy to Ethereum mainnet.
- Use mock financial assets and mock stablecoins only.

## EXECUTION ORDER

Complete this enhancement incrementally:

**Milestone 1:** Repository inspection and architecture.

**Milestone 2:** Mock stablecoin and offering configuration.

**Milestone 3:** Subscription window and stablecoin commitments.

**Milestone 4:** Finalisation and pro-rata allocation mathematics.

**Milestone 5:** Pull-based refunds, token claims and issuer proceeds.

**Milestone 6:** AssetFactory and frontend integration.

**Milestone 7:** Adversarial testing, rounding analysis and security fixes.

**Milestone 8:** Complete demonstration, documentation and AI Audit Report updates.

Test each milestone before proceeding to the next.

**BEGIN NOW. Inspect the existing project, design a mathematically correct and gas-safe subscription engine, implement it within the current architecture, integrate the frontend, execute comprehensive tests, and deliver the complete feature.**