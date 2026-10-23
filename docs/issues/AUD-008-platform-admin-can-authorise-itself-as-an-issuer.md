# AUD-008: Platform admin can authorise itself as an issuer

| Field | Value |
|---|---|
| Status | open |
| Severity | critical / high / medium / low / info |
| Category | access control / reentrancy / integer or math / gas / logic / spec gap / frontend / other |
| Found by (method) | unit test / fuzz / invariant / Slither / manual review / AI review / testnet |
| Found by (person) | |
| Location | file and line, at commit |
| AI session that produced the code | docs/ai-logs/... |
| Baseline commit | |
| Regression test commit | |
| Fix commit | |

## What is wrong

Short description with the offending code.

## 1. Why the AI made the mistake

Only what the transcript or code shows. Prefix guesses with `Hypothesis:`. Typical causes: deprecated syntax, missing context in the prompt, spec ambiguity, no knowledge of an attack pattern.

## 2. Why it is a problem

Real-world impact: drainable funds, stuck tokens, compliance bypass, privilege escalation, wrong prices. Include a concrete attack or failure sequence.

## 3. How we fixed it

Code change (link the fix commit), and any re-prompt, spec change or new CLAUDE.md rule.

## 4. Evidence the fix works

- Regression test: `test/...` :: `testName`
- Before: `docs/evidence/runs/..._AUD-008-before/test.log` (test fails)
- After: `docs/evidence/runs/..._AUD-008-after/test.log` (test passes)
- Slither before/after (if relevant):
- Testnet transaction (if relevant):
