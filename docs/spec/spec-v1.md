# Spec v1: frozen specification

Status: DRAFT. The spec is frozen when every `TODO(decision)` marker below is gone. Claude Code will refuse to write contracts until then (see CLAUDE.md).

How this version was produced: human decisions, with AI-assisted research. The research sessions are logged in `docs/ai-logs/INDEX.md`. Changes from `spec-v0.md` are explained in section 10.

Write this file in your own words. Each section below says what it needs to contain.

## 1. Problem and trust model

What problem the system solves, and what it does not solve. State who has to be trusted (the issuer) and for what. State that the token is a share register and the legal claim sits off-chain.

TODO(decision): write the "why a blockchain" paragraph.

## 2. Asset and scope

TODO(decision): which instrument (money-market fund, bond, gold).

## 3. Roles

For each role (issuer admin, compliance agent, investor), list exactly what it can and cannot do.

## 4. Contracts and state

For each contract: its purpose, its state variables, and which other contracts it calls.

TODO(decision): price model (fixed $1 or issuer-set NAV).
TODO(decision): DvP design (approve-based or escrow).
TODO(decision): which extra features are in scope (freeze, forced transfer, pause, redemption, one compliance rule, yield).

## 5. Functions

For every external function: who may call it, preconditions, effects, events emitted, and what must revert.

TODO(decision): subscription flow (instant or request-and-approve).

## 6. Invariants

Properties that must hold after any sequence of calls. These become invariant tests. Examples of the kind of statement wanted: "every address with a non-zero balance is verified", "total supply equals the sum of balances".

## 7. Frontend

Screens per role, what each screen shows, and which contract calls it makes.

## 8. Out of scope

Things deliberately not built, with one line each on why.

## 9. Assumptions

Network, token decimals, test wallets, anything the code depends on.

## 10. Changes from v0

For each change from `spec-v0.md`: what changed, why, and whether AI research influenced it (link the session in `docs/ai-logs/INDEX.md`).
