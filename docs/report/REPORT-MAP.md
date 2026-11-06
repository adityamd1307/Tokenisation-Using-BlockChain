# Where each report section's evidence lives

| Report section | Evidence |
|---|---|
| 1. Initial Specification & System Scope | `docs/spec/spec-v0.md`, preserved `spec-v0` content and session evidence (tag dates alone do not establish when the prose was written) |
| 2. Development Methodology & AI Tooling | `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`, `scripts/`, `docs/ai-logs/INDEX.md` (Who and Tool columns show division of labour) |
| 3. Specification Engineering & Prompt Logs | `docs/spec/spec-v1.md` and its git history, `git log -p CLAUDE.md` (how our instructions to the AI evolved), `docs/ai-logs/exports/` |
| 4. AI-Generated Architecture | Per-phase tags marking each first complete AI generation, never edited: `ai-baseline-phase2`, `ai-baseline-phase3` (both created retroactively), `ai-baseline-phase4`, `ai-baseline-d5`. A single `ai-baseline` tag was planned but never created; each tag's annotation says how and when it was made |
| 5. Problems Discovered & Vulnerability Analysis | `docs/issues/INDEX.md` and each `AUD-NNN` file |
| 6. Validation Process & Testing Strategy | `test/`, `docs/evidence/runs/`, `docs/evidence/testnet-log.md` |
| 7. Improvements & Refinements | `git diff ai-baseline-phase3..main`, commits prefixed `human:` and `fix(...)` |
| 8. Lessons Learned | "Outcome" column of `docs/ai-logs/INDEX.md`, "Why the AI made the mistake" sections across issues, "Rules learned" in `CLAUDE.md` |
| 2.2 Major issue breakdowns | One `AUD-NNN` file per issue, four sections each |

Useful commands when writing the report:

```bash
git log --oneline --grep '^ai:'            # what the AI wrote
git log --oneline --grep '^fix(AUD'        # every fix
git diff --stat ai-baseline-phase3..main          # how far we moved from the AI output
git log --format='%an' | sort | uniq -c    # commits per person
```

Phase 4 additions (28 October 2026, uncommitted by user instruction):

- Specification and prompt: `docs/spec/phase4-requirements.md`.
- Current architecture/workflows/status: `docs/phase4-implementation.md`.
- Curated AI decisions and actual errors: `docs/ai-logs/phase4-session.md`.
- Frontend defects with failing-before/passing-after evidence: AUD-009 and AUD-010.
- Behavior tests: `frontend/src/test/`; actual local-chain integration: `frontend/integration/lifecycle.test.ts`.
- Command outputs and per-file manifest: `docs/evidence/phase4/`.
- Manual MetaMask and responsive layout verification remain outstanding; do not describe automated EIP-1193 adapter tests as wallet-extension evidence.

Phase 6: the eight-section report is `docs/AI_Audit_Report.md`; fresh command results, detector triage, exact local lifecycle and file hashes are in `docs/audit/`. No commits or public transactions were made.
