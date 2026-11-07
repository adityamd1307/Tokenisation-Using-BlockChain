# ERC-3643 comparison

This project implements an **ERC-3643-inspired Lite framework**, not the complete standard and not a legal compliance certification. Research inspected the [official ERC-3643 specification](https://eips.ethereum.org/EIPS/eip-3643), Tokeny's [Identity Registry interface](https://github.com/TokenySolutions/T-REX/blob/main/contracts/registry/interface/IIdentityRegistry.sol) and [Modular Compliance interface](https://github.com/TokenySolutions/T-REX/blob/main/contracts/compliance/modular/IModularCompliance.sol). Reference code was inspected for architecture, not copied into this MIT-licensed implementation.

| Capability | ERC-3643 / T-REX architecture | This implementation |
|---|---|---|
| ERC-20 | Standard token compatibility | OpenZeppelin v5, zero decimals, fixed constructor supply |
| Identity Registry | Wallet-to-identity verification | Per-asset simulated credential registry |
| Identity Registry Storage | Separate storage interface | Storage inside Lite registry |
| ONCHAINID claims | Identity contracts and trusted claim verification | No identity contracts or signatures; role-authorized synthetic attestations |
| Trusted Issuers Registry | Claim issuers and supported topics | AccessControl attestor role; no claim topics |
| Claim Topics Registry | Required claim topics | Omitted |
| Compliance | Transfer validation and lifecycle hooks | Three read-only policies; no lifecycle state hooks |
| Jurisdiction / holdings / accreditation | Configurable policy layer; not a universal legal rule | Three independently configurable demo rules |
| Agents / ownership | Standard agent and owner interfaces | Separate registry roles, immutable policy administrator, exact custody classification |
| Pause / freeze | Token-level controls | Not implemented on regulated tokens |
| Mint / burn | Controlled lifecycle operations | Initial fixed mint only; no external mint/burn |
| Recovery / forced transfer | Controlled agent operations | Omitted on regulated tokens |
| Batch operations | Standard batch interfaces | Omitted |
| Component updates | Reference configuration functions | Immutable references / one-time binding |

The reference identity registry separates identity storage, trusted issuers and claim topics, and exposes `isVerified`, identity/country reads and controlled updates. Lite merges credential storage and trusted-attestor membership into one contract and replaces claim validation with explicit synthetic metadata. Removing an attestor role invalidates its credentials by current membership; re-attestation is an on-chain update, not a cryptographic claim.

Tokeny's modular compliance interface separates read-only `canTransfer` from token-authorized transfer/mint/burn notifications, and supports binding/modules. Lite has no mutable transfer counters or module installation; it reads the bound token's actual balance and applies a static set of policy checks. Binding is one-time and cannot be replaced. This reduces complexity at the cost of standard lifecycle flexibility.

Lite checks identity at **both ordinary investor endpoints**. This is intentionally stricter than the reference's recipient-oriented identity gate; it can immobilize a revoked holder until renewal. Country/accreditation remain recipient rules. Operational accounts are narrowly defined project custody exceptions, not a claim of implementing T-REX agent semantics.

The historical legacy token still has its prior pause/forced-transfer behavior. That does not supply missing standard features to a regulated token, and the two implementations must not be conflated when presenting standards coverage.
