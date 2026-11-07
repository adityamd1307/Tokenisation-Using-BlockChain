# AUD-018: Compliance checker retains issuer sender during wallet connection

| Field | Value |
|---|---|
| Status | fixed in working tree; no commit requested |
| Severity | low |
| Category | frontend asynchronous account state |
| Found by | New compliance component test, 7 November 2026 |
| Location | frontend/src/pages/CompliancePage.tsx Workspace key / sender initializer |
| Evidence | docs/evidence/compliance/AUD-018-before.log and AUD-018-after.log |

## 1. Why the AI made the mistake

The generated workspace was keyed by asset and wallet session only. Wallet connection first increments the session with no resolved account, then fills the account asynchronously within that same session. The `useState(wallet.account || asset.issuer)` sender initializer therefore ran with the issuer and remained unchanged when the investor address arrived. This causal chain is visible in WalletContext and the generated component; no hidden reasoning is inferred.

## 2. Why it is a problem

The checker could prefill an issuer sender after an investor connected. Its result was valid for the displayed sender but could mislead someone expecting their own wallet's outgoing identity checks. It was not a token enforcement bypass: the actual transaction always used the wallet signer and checked sender identity on chain.

## 3. How we fixed it

Include resolved account identity as well as session and token in the workspace key. Account resolution, switching and disconnect now remount account-specific forms/results. Public registry data remains separate. No commits were made under the user's no-commit instruction.

## 4. Evidence the fix works

- [Before](../evidence/compliance/AUD-018-before.log): `uses authoritative preflight...` fails because the actual sender is ISSUER when INVESTOR was expected. The same log includes a separate incorrect assertion about the shared confirmation label; that test expectation was aligned to the existing label, not portrayed as another product defect.
- [After](../evidence/compliance/AUD-018-after.log): all 140 frontend tests pass, including preflight sender and wallet-switch state clearing.
- Regression: `frontend/src/test/compliance.test.tsx`, “uses authoritative preflight, explains holding failure, and invalidates edited results” and “refreshes credential state on wallet switch and clears prior lookup/form state”.
- Existing signer/deployment checks and real-chain token tests remain passing. No fabricated exploit transaction or public deployment is claimed.
