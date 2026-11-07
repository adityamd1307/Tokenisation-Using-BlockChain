# Phase 6 pre-merge verification — 7 November 2026

**Who did this.** Claude Code session f349e0d7 (claude-opus-5-5), directed by Chordia Laksh. Phase 6 itself was built by adityamd with Codex and committed as c7cb0d1 ("initial commit", parent 0b1249e) on `origin/phase-6`. This is a different AI tool reviewing another tool's work. That makes it more independent than the earlier same-session self-reviews, but **it is still an AI review, not a human review**. Nothing here was run on Sepolia, in MetaMask or in a real browser.

**Method.** All checks ran in a separate git worktree of c7cb0d1, on Windows 11 with Node 24.15.0, Hardhat 3.21.0 and fresh `npm ci` installs. The user's working tree was never used for builds or tests. Codex's own runs were on macOS with Node 22.18.0. The merge and the follow-up commits were made in a separate worktree of `main`. Raw outputs are in `docs/evidence/phase6-verification/` and `docs/evidence/aud-030/`. The before/after runs are in `docs/evidence/runs/*_AUD-030-*`.

**Numbering.** This document calls the Phase 6 issue **AUD-030**. In c7cb0d1 it is AUD-016. It was renumbered on main because three lines of work allocated numbers independently; see `docs/issues/INDEX.md`.

## 1. Verification table

| Claim | What the branch says | What was measured here | Match |
|---|---|---|---|
| Contract and script tests | `npm test`: 153 passing | 153 passing, 0 pending, exit 0 (`contracts-tests.log`) | yes |
| Frontend tests | `npm test --prefix frontend`: 122 | 122 passed in 10 files (`frontend-tests.log`) | yes |
| Root typecheck | `npx tsc --noEmit` passes | exit 0, no output | yes |
| Frontend build | passes | `tsc --noEmit && vite build`, exit 0, 216 modules | yes |
| Real-chain integration | 1 lifecycle test passes | 1 passed against a fresh `hardhat node` started from the worktree (`aud-030/integration-after.log`) | yes |
| Phase 5 replay | 12 steps in-process | `npm run replay:ephemeral`: all 12 steps, 34 checks, exit 0 | yes |
| Audit demo | 31 checks, 18 receipts, 3 expected reverts; CPT 9850/80/70/0; 0.15 ETH withdrawn | Identical: 31/31 checks; 18 receipts, 15 with status 1 and 3 with status 0; finalCpt 9850/80/70/0, supply 10000; "Proceeds 0.15 ETH withdrawn". The regenerated `final-demo.json` equals the committed one in checks, balances, addresses, statuses and gas. Only transaction hashes differ (timestamps) | yes |
| Coverage, production contracts | 100% lines and statements | AssetToken, AssetFactory and AssetSale each 100.00 / 100.00 | yes |
| Coverage including test helpers | 99.25% lines / 99.37% statements | 99.43% lines / 99.37% statements. Per-file figures are identical, only the total differs (Windows run vs macOS run). Not changed in the docs | minor difference |
| Bytecode sizes (AUD-012) | 13545 / 4124 / 3132 bytes, unchanged | Same in both the default and production profiles; 11031 bytes below EIP-170 for the factory (`bytecode-sizes.txt`) | yes |
| Gas observations | factory deploy 2,973,114; createAsset 1,925,522–2,013,385; buyTokens 55,057–89,269 | Same min/max (gas table of the AUD-030-after run) | yes |
| Production Solidity unchanged | only `contracts/test/SaleCallbackHarness.sol` is new | `git diff 0b1249e c7cb0d1 -- contracts`: only that file | yes |
| Slither | 29 findings, all classified; 22 contracts, 102 detectors | Not re-run (not installed; nothing installed). In the committed JSON: 29 results, `success: true`. The triage has 29 entries matching all 29 Slither IDs 1:1. 3 false positives, 26 informational, none confirmed. Every finding the triage calls "test-only" is in `contracts/test/`. Severity split 2/4/7/16 matches | consistent; not re-executed |
| Baseline 23 → final 29 Slither results | caused by the new helper | The 6 extra results are all in `SaleCallbackHarness.sol` | yes |
| Source manifest | fingerprints the final files | All 99 SHA-256 entries match the blobs in c7cb0d1 | yes |
| npm audit counts | root 16 dev nodes; frontend and production 0 | Not re-run | not verified |
| Codex environment (macOS, Node 22.18.0, Python 3.13.2, Slither 0.11.6) | as stated | Not verifiable from here. Lockfile versions match the report (Hardhat 3.21.0, OZ 5.6.1, ethers 6.17.0, React 18.3.1, Vite 6.4.5, Vitest 4.1.12, TS 7.0.2/6.0.3) | partly |

## 2. AUD-030 (c7cb0d1's AUD-016): is it a real behavioural fix?

Yes, with one untested part.

- **Before.** c7cb0d1 with 0b1249e's `blockchain.ts` put into the worktree (`git checkout 0b1249e -- <file>`; history unchanged). Exactly the 4 new tests fail and the other 118 pass. The three rejection cases fail with "promise resolved `JsonRpcSigner` instead of rejecting". The positive case fails because `eth_getCode` was never requested. These are behavioural failures, not missing-ABI failures (AUD-006/007 rule).
- **After.** 122 pass. The `evidence.sh` runs are AUD-030-before (`-dirty`, 153 passing) and AUD-030-after (clean c7cb0d1). The root suite cannot show this defect, because `evidence.sh` runs only the Hardhat suite. The frontend logs carry that evidence instead, as for AUD-013 and AUD-015.
- **Mutations (AUD-005 rule)** (`aud-030/mutation-*.log`, `aud-030/mutate.ps1`):

| Mutant | Effect | Result |
|---|---|---|
| M1 | remove `await this.ready(provider)` from `signer()` | 4 fail |
| M2 | `ready()` uses `this.provider` and ignores its parameter | 4 fail |
| M3 | only `getBlock(deployBlock)` reads from the public RPC | 2 fail |
| M4 | delete the chain/account recheck after `ready(provider)` | **0 fail: untested** |

The reports say `signer()` "then rechecks chain/account". That recheck is implemented, but no test covers it. Removing it leaves the suite green.

- **Phase 5 and Sepolia/MetaMask impact (reasoned from the code; not tested).**
  - Each signing action now also sends `eth_chainId`, `eth_getCode(factory, latest)` and `eth_getBlockByNumber(deployBlock, false)` through the wallet. A second `eth_chainId` and `eth_accounts` pair follows, before `eth_sendTransaction`. All are standard read methods that MetaMask forwards to its network RPC without a prompt.
  - Expected cost: a few extra round trips before the confirmation prompt. This was not measured.
  - Plausible failures:
    - (a) Just after a deploy, a wallet RPC that lags the public RPC returns `0x` or no block. The user then sees the misleading "chain may have reset" or "earlier blockchain session" message until the node catches up.
    - (b) Rate limits or outages on the wallet's RPC now fail before the prompt rather than at submission, with the same root cause.
    - (c) Hypothesis: MetaMask caches some block-tagged reads. After a local Hardhat restart with the same chain ID, a cached block hash could trigger a false "earlier session" error until the wallet's network is reset.
  - Block parsing is the same ethers 6.17 code the read path already uses, but neither path has run against Sepolia.
  - The AUD-002 rehearsal (7c73461) ran at 0b1249e, **before** this change, so it does not cover it.

## 3. Secret and privacy scan of every file the branch adds or changes (100 files)

Scripts: `docs/evidence/phase6-verification/scan.mjs`. The dev-key hashes are read from `.claude/hooks/archive_transcript.mjs`. The BIP-39 list is ethers' bundled English list. Only counts and locations were printed.

| Check | Count |
|---|---|
| Hardhat dev keys (by SHA-256) | 0 |
| Hardhat seed phrase / any run of ≥12 BIP-39 words | 0 / 0 |
| Non-noreply email addresses in files | 0 |
| Keyed RPC URLs, `?key=`-style parameters, API-key shapes, secret assignments | 0 |
| 64-hex values next to "private key/secret/mnemonic" that are not dev keys | 0 |
| **Absolute local paths (privacy)** | **334**, all of one macOS username: 306 in `docs/audit/slither-results.json` and `slither-baseline-results.json`, 28 in 15 `docs/audit/logs/*.log` files |

Commit metadata: c7cb0d1's author and committer email is a non-noreply work-domain address. It is already published on `origin/phase-6` and cannot be removed without rewriting history. The paths are also published, and are left as tool output.

## 4. Report claims checked against the repo

**Correct.** All five "verbatim" prompt quotes appear in their requirements files. Every cited test file, evidence log and raw session exists. The historical before/after figures for AUD-004 to AUD-015 match the issue files. All relative links in the changed Markdown resolve. No report claims Sepolia results or a MetaMask transaction. All eight AI Audit Report sections are present, match the REPORT-MAP section list, and give the four required elements per finding. The UI labels used in `Final_Demo_Guide.md` exist in the frontend. The README is right that there are no pause or forced-transfer UI controls on this branch.

**Wrong or stale. Corrected on main in commit "docs: correct Phase 6 report statements…":**
1. "uncommitted" or "no commits" was stated as the current repository state in the AI report header and Section 2, the Technical Report header, the final audit summary, REPORT-MAP and the README. The session made no commits, but c7cb0d1 exists.
2. AUD-002 was described as open. After the Codex session, 7c73461 accepted it for 0b1249e on the user's report.
3. "Phase 6 changed only two production frontend files". It also committed a regenerated `addresses.json`.
4. The AUD-030 table status read "Fixed in Phase 6 working tree".
5. The README said every defect from AUD-005 onward, except AUD-009 and AUD-010, has separate test and fix commits. AUD-030 does not.
6. The AI-log INDEX row said "current session" and "Who: User-directed", and recorded no commits.
7. REPORT-MAP's tag list lacked `ai-baseline-phase5`. This gap predates Phase 6.

**Unverifiable here.** Slither execution details, npm audit counts, Codex's macOS environment, "browser discovery returned []", and the curated session narrative (there is no raw transcript).

**Missing against the Phase 6 plan (Task 6.3 package):**
- testnet contract addresses (no Sepolia deploy yet, AUD-003 open);
- demo screenshots or recordings (none captured; the AUD-002 screenshots are also still to be added);
- team identity and contribution fields in the AI report (left as labelled placeholders);
- a raw Codex prompt log for Phase 6. Phases 2 and 4 have the same gap.

The plan's Task 6.2 asks for `docs/audit-findings.md`. The repository uses `docs/issues/` (AUD files) and `docs/audit/security-findings.md` instead, and the content is equivalent.

**Left as written:** Codex's session records (`phase6-session.md`, `baseline-results.md`, `test-results.md`, `changed-files.md`). Their "uncommitted" was true when they were written.

## 5. Consistency with existing docs

- The issue INDEX, AI-log INDEX, README counts and tag list, and REPORT-MAP are updated as above. The CLAUDE.md rule cites AUD-030, noting it was "numbered AUD-016 in c7cb0d1".
- The AUD-007 follow-up describes four callback behaviours across the three new callback tests. That is consistent with `Phase6.security.test.ts`, which has 3 tests in "Phase 6 withdrawal callbacks".

## 6. Findings

No new defect in the dApp was found, so no new AUD issue was opened. Observations:

- **O-1** The AUD-030 post-validation recheck is untested (M4 above). A test would need a wallet whose `eth_chainId` or `eth_accounts` changes during validation.
- **O-2** Workflow deviation. There is no `test(AUD-NNN)`/`fix(AUD-NNN)` pair, no prefix on c7cb0d1, and no `evidence.sh` runs from the Codex session. The runs were added after the fact (above), and the history was left as it is.
- **O-3** On Windows (`core.autocrlf=true`), frontend `pretest`, `prebuild` and `predev` rewrite the three committed ABI JSON files with LF endings. `git status` then shows them modified while their content is identical. This predates Phase 6, and it is the cause of the "modified" ABI files in the user's tree. A `.gitattributes` entry such as `frontend/src/config/**/*.json text eol=lf` would stop it. Not done; the user should decide.
- **O-4** AUD numbers were allocated independently by Phase 6, `frontend-redesign` and the planned review pass, which caused the renumbering.
- **O-5** Merging `frontend-redesign` later will conflict with Phase 6 in `CLAUDE.md` (rule list), `docs/issues/INDEX.md` and `frontend/src/services/blockchain.ts`. There will also be a modify/delete conflict on `frontend/src/components/AppLayout.tsx`, which is deleted in that working tree. After that merge, re-run `signingDeployment.security.test.ts` to confirm the AUD-030 checks survive.
- **O-6** A mistake by this session during the work: a PowerShell `[IO.File]` call with a relative path read and rewrote the user's working-tree `docs/issues/INDEX.md` instead of the merge worktree's copy. Its content was byte-identical afterwards (same git blob, clean status), and only the modification time changed.

## 7. Decisions taken by the user in this session

- Merge in a separate worktree of `main`; the user's working tree was not touched.
- Create an annotated `ai-baseline-phase6` tag on c7cb0d1.
- Record AUD-030 evidence after the fact (evidence.sh plus frontend and mutation logs).
- Restore main's `addresses.json` in a `chore:` commit.
- Correct the docs on main in `docs:` commits.
- Accept 7c73461 (AUD-002 accepted).
- Ask adityamd for a redacted Codex export.
- Run integration on a fresh node, after the user stopped theirs.
- Renumber AUD-016 to the reserved AUD-030.
- Archive only this session's transcript.

## 8. Not verified

- Anything on Sepolia.
- MetaMask or any real browser, including the Phase 6 signing change.
- macOS or Linux installs.
- A Slither or npm audit re-run.
- Codex's environment and session narrative.
- Production use.

## 8a. After verification: merging origin/main (7 November 2026)

Before the push, `origin/main` had gained adityamd's auction branch through PRs #3 and #4 (d9ff2f5, b228460). It is based on 0b1249e, so it does not contain Phase 6. It adds subscription offerings, ERC-3643-lite compliance, an identity registry and MockUSD, and changes `contracts/AssetFactory.sol`: 165 files in all. It also brings its own AUD-016 to AUD-018 and its own `docs/AI_Audit_Report.md`. With the user's approval, this session merged it into main (c263253) and resolved 7 conflicts; the merge commit message records how each was resolved.

| Check on the merged tree | Result |
|---|---|
| `npm test` | 240 passing (origin/main's 229 plus Phase 6's 11) |
| `npm test --prefix frontend` | 144 passed in 12 files (140 plus Phase 6's 4, including the AUD-030 regressions) |
| `npx tsc --noEmit`, frontend build | pass |
| `npm run test:integration` on a fresh node | 3 suites (lifecycle, compliance, subscriptions), 3 passed |
| Phase 6 audit demo / Phase 5 replay | 31 checks pass / 12 steps and 34 checks pass |
| Runtime sizes, default and production | AssetFactory 13598 (+53 from origin/main's change), AssetToken 4124, AssetSale 3132; 10978 bytes below EIP-170 |
| `ready()` in `blockchain.ts` | byte-identical to c7cb0d1 |

These results show that the two lines of work build and pass their own tests together. **They are not a review of the subscription or compliance feature**, which this session did not audit. Things to know about it:
- It modifies the production AssetFactory.
- Like Phase 6, its issues were recorded "without commits", with no `test(AUD-NNN)`/`fix(AUD-NNN)` commits.
- Its commits ("initial commit", "feature-2") have no CLAUDE.md prefix.
- It commits a file named `project (1).pdf` at the repository root. If that is the course brief, the team should check whether it may sit in a public repository.
- Both lines of work wrote an eight-section `AI_Audit_Report.md`. They are now `docs/AI_Audit_Report.md` (Phase 6) and `docs/AI_Audit_Report-subscription.md`. The team must consolidate them into one report.

## 9. For adityamd

- **Phase 6 has been merged.** Your AUD-016 is **AUD-030 on main**. Raw logs and the source manifest keep the old number.
- **Codex export.** Please export the Phase 6 Codex session, redacted (no keys, emails or local paths), into `docs/ai-logs/raw/`, and record the model label. Phases 2 and 4 have the same gap.
- **Commit hygiene.** For future commits, use a GitHub noreply email (`git config user.email`) and CLAUDE.md commit prefixes, with separate `test(AUD-NNN)` and `fix(AUD-NNN)` commits.
- **Absolute paths.** The Slither JSONs and logs contain your local macOS username and directory layout. Pass `--filter-paths`, or post-process paths to repo-relative ones, before committing tool output.
- **Missing test.** Please add a test that fails without the post-validation chain/account recheck in `Blockchain.signer()` (O-1).
- **MetaMask check.** The signing change still needs a MetaMask check, on local first and then on Sepolia.
