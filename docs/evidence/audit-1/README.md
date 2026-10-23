# Audit 1: AI review of the project state at 7fd3e26

| Field | Value |
|---|---|
| Audited commit | `7fd3e26` (main after Phase 3) |
| Date | 2026-10-23 |
| Performed by | Claude Code, session `7b0eabb6-ecbd-4dbb-b515-64d2958841d4` (transcript in `docs/ai-logs/raw/`) |
| Independence | Limited. The auditor ran on `claude-opus-5-5`, the same model as the Phase 3 session that wrote AssetFactory and AssetSale (verified from the per-message `model` field in both raw transcripts). No human has reviewed these findings yet. |
| Critique of the audit | Phase 3 session `c567bbec-8104-4601-9e63-6ad5e37d5896` spot-checked F-01, F-02, F-13, F-15 and F-16 and confirmed them. It challenged the wording or severity of F-04, F-05, F-06, F-10 and F-11. |

The artefacts were copied unchanged from the audit session's temporary scratchpad. The only change is the probe file extension.

| File | What it is | How it was produced |
|---|---|---|
| `mutate.ps1` | Mutation runner: applies each mutant, runs `npx hardhat test`, restores the file with `git checkout -- <file>` | Written by the audit session |
| `mutants.txt` | Results for 30 mutants: 28 killed, 2 survived (M23, and M25, which is equivalent) | `mutate.ps1` against 7fd3e26 |
| `audit-probe.test.ts.txt` | 10 probe tests (P1–P10). Each one asserts that a suspected defect **exists**. Renamed to `.txt` so `npx hardhat test` does not run it: once the defects are fixed, these probes are expected to fail. | Placed temporarily in `test/zz-audit-probe.test.ts` |
| `probe.log` | Probe output: 10 passing, confirming each probed defect at 7fd3e26 | `npx hardhat test mocha test/zz-audit-probe.test.ts` |

The audit's full report (findings F-01 to F-17) is in the audit transcript. The findings that became issues are AUD-005 to AUD-008 in `docs/issues/`.
