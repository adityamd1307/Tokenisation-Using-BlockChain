# Subscription allocation and solvency

This is the implemented rule, not a proposed future design. See [SubscriptionOffering](../contracts/SubscriptionOffering.sol) and the [governing specification](subscription-offering-specification.md).

## Units and immutable inputs

- `S`: offered whole asset-token units (AssetToken has zero decimals).
- `P`: mUSD base units per asset unit. One mUSD = 1,000,000 base units.
- `H = S × P`: hard cap, checked for overflow at construction.
- `K`: soft cap, with `0 < K ≤ H`.
- `c_i`: investor i's commitment; every deposit is a positive multiple of P.
- `C = Σ c_i`: gross demand; C may exceed H.
- `n`: distinct nonzero subscribers; top-ups do not increase n.

No monetary calculation uses JavaScript floating point. Solidity uses checked arithmetic and OpenZeppelin Math.mulDiv for full-precision proportional division. Frontend prices use parseUnits/formatUnits with six decimals and BigInt. Date conversion and CSS presentation do not participate in accounting.

## Final allocations

After a successful finalisation:

```
If C <= H:  a_i = c_i / P
If C > H:   a_i = floor(c_i × S / C)
accepted_i = a_i × P
refund_i   = c_i - accepted_i
```

If the offering fails, `a_i = accepted_i = 0` and `refund_i = c_i`.

The commitments, denominator C, supply and price cannot change after the window. Allocation is independent of settlement, refund and claim ordering. Investors receive no allocation until finalisation; their final view is readable before settlement, and settlement stores it without transferring anything.

## Why the soft cap is genuine

For undersubscription, each commitment is a multiple of P, so total accepted funding is exactly C. Success requires `C >= K`.

For oversubscription let `x_i = c_i × S / C`. Then `Σ x_i = S`. Each fractional part is less than one, so:

```
Σ floor(x_i) = S - Σ fractionalPart(x_i) > S - n
```

The left side is an integer. Therefore a safe lower bound on accepted tokens is `L = max(0, S - n + 1)`, and accepted funding is at least `L × P`. Success requires `L × P >= K`. Finalisation also requires the configured inventory to have been deposited and the escrow to cover the maximum allocation. An underfunded or empty offering fails.

This conservative rule can reject an offering that would meet its soft cap under exact enumeration. Example: seven units at 2 mUSD, three subscriptions of 6 mUSD each. Exact allocation is 2/2/2, accepting 12 mUSD. The guarantee is only 5 units × 2 = 10 mUSD. A 10 mUSD soft cap succeeds; a 12 mUSD soft cap conservatively fails; a 14 mUSD soft cap correctly fails despite 18 mUSD demand. Tests cover all three implications.

Whitelisted investors splitting commitments across more wallets may lower the guarantee and force a conservative failure. This implementation does not claim Sybil resistance. Issuers should use appropriate unit granularity and leave a margin between soft and hard caps. Exact bounded multi-stage finalisation is a possible future alternative; it is not implemented. The UI displays the rule and never treats gross demand as proof of success.

## Requested example, executed

S = 1,000 CPT; P = 2 mUSD; K = 1,200 mUSD; H = 2,000 mUSD; C = 4,000 mUSD; n = 3. The guarantee is 998 CPT × 2 = 1,996 mUSD, so the offering succeeds. Exact accepted funding becomes known through individual settlements:

| Investor | Commitment mUSD | Allocation CPT | Accepted mUSD | Refund mUSD | Final wallet mUSD from 10,000 |
|---|---:|---:|---:|---:|---:|
| A | 1,800 | 450 | 900 | 900 | 9,100 |
| B | 1,400 | 350 | 700 | 700 | 9,300 |
| C | 800 | 200 | 400 | 400 | 9,600 |
| Total | 4,000 | 1,000 | 2,000 | 2,000 | 28,000 |

These values are assertions against executed contracts in [demo.json](evidence/subscription/demo.json), not frontend fixtures. The contract's guarantee is 1,996 mUSD, distinct from the actual final 2,000 mUSD accepted. The demo derives exact totals from settled entitlements.

## Conservation and caps

For oversubscription, `Σ a_i ≤ S`. Because `S × P = H < C`, each `a_i × P ≤ c_i`; thus refunds cannot be negative. It follows that `Σ accepted_i ≤ H` and `accepted_i + refund_i = c_i`. Under subscription these equalities hold directly because c_i is a price multiple.

Define D = settled commitments, F = outstanding refund credits, Q = refunds paid, R = recognised proceeds, W = proceeds withdrawn. The contract maintains:

```
D = R + F + Q
paymentLiabilities = (C - D) + F + (R - W)
paymentToken.balanceOf(offering) >= paymentLiabilities
C = paymentLiabilities + Q + W
```

Settlement moves liability from unsettled escrow into refund credits and proceeds without reducing the total. Refund and proceeds withdrawals reduce the corresponding liability only; effects precede the transfer and the entire transaction reverts on transfer/delta/solvency failure. Donations increase the balance but do not enter C, D or R. They cannot be withdrawn as issuer proceeds.

## Inventory reserves and dust

Before all subscribers settle, reserve `maximumAllocation - totalClaimed`, where maximumAllocation is C/P under subscription or S over subscription. Once every subscription is settled, reserve `totalAllocated - totalClaimed`. A failed offering reserves zero claim tokens. The issuer may recover only balance above that reserve after finalisation.

For seven tokens allocated 2/2/2, the one-token remainder unlocks only after all three subscriptions settle. All six claim units remain protected even if nobody has claimed. `settleFor(investor)` lets any caller materialise another investor's immutable accounting, without moving their money or tokens. This prevents a dormant subscriber from permanently blocking precise dust accounting when someone is willing to pay for their settlement.

## Limits

The algebra establishes properties of the stated integer rule; tests are finite implementation checks, not formal verification of the bytecode. Tokens remain subject to the existing issuer's pause, revocation and forced-transfer powers. A revoked investor retains its allocation and may withdraw its refund, but claiming may require reapproval. Accepted payment is not automatically refunded when a claim is blocked. There is no claim deadline or confiscation through the offering's recovery API.
