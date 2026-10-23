# AUD-002: Frontend dashboards and wallet integration are unimplemented

| Field | Value |
|---|---|
| Status | open |
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

Open; no implementation change made during verification. Required next work: Implement spec §7 dashboards, routing, wallet and chain handling, and deployed-address loading; verify the complete user flows.

## 4. Evidence the fix works

No fix or regression result is claimed. See `docs/VERIFICATION.md` for observed command results and limitations.
