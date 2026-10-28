# AUD-002: Frontend dashboards and wallet integration are unimplemented

| Field | Value |
|---|---|
| Status | implemented and automated-verified locally; genuine browser/MetaMask acceptance pending |
| Severity | high |
| Category | frontend |
| Found by (method) | manual code review and command execution |
| Found by (person) | Codex |
| Location | frontend/src/App.tsx:6; frontend/src/pages/; frontend/src/config/addresses.json, baseline c504215 |
| AI session that produced the code | Unknown; no attribution inferred |
| Baseline commit | c504215 |
| Regression test commit | None |
| Fix commit | None |

## What is wrong

The application renders navigation only. Dashboard components are placeholders and are never routed or imported. There is no MetaMask connection or contract interaction, and the factory address is empty. The buy, transfer, issuer and admin workflows cannot be exercised.

## 1. Why the AI made the mistake

The source explicitly labels these areas as future phases. The original generation transcript was not inspected; no causal claim is made.

## 2. Why it is a problem

The application cannot satisfy its frozen specification or support an end-to-end demonstration. A successful compile or zero-exit test command does not establish working behavior.

## 3. How we fixed it

Phase 4 (28 October 2026) implements the requested React frontend, routing, EIP-1193/EIP-6963 wallet handling, admin and issuer workflows, purchases, portfolio, transfers, transaction feedback, on-chain history and generated deployment configuration. Solidity was preserved. See [implementation report](../phase4-implementation.md) and [changed-file manifest](../evidence/phase4/changed-files.md).

This remains a phase-completion tracking issue, not evidence that the original scaffold was an AI defect. No commits were made because the user explicitly prohibited them.

## 4. Evidence the fix works

Actual validation: 112 frontend behavior tests, 108 existing contract tests, a production frontend-service lifecycle on the persistent local node, production build, root typecheck and HTTP route smoke checks pass. Results are in [Phase 4 evidence](../evidence/phase4/README.md).

No connected browser was available. Real MetaMask signing, wallet popup rejection/account switching and responsive visual QA remain on the [manual checklist](../phase4-implementation.md#remaining-genuine-browser-verification). Automated providers are not claimed as wallet-extension evidence. Historical `docs/VERIFICATION.md` describes earlier observations, not the current frontend.
