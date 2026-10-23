# AI session index

One row per session that mattered. "Context given" means what the tool was shown: spec version, files, CLAUDE.md version. "Outcome" is what we kept, what we threw away, and any issues it produced.

| Date | Who | Tool and model | Purpose | Context given | Outcome | Issues | Transcript |
|---|---|---|---|---|---|---|---|
| 2026-10-23 | Laksh | claude.ai (Claude Opus 5.5), project chat | Research on tokenisation use cases; review of proposal gaps; plan for spec v1 and this evidence pipeline | Course brief PDF, spec v0 | Decision list for spec v1; this repo's evidence setup | | exports/2026-10-23-claude-ai-research.md |
| 2026-10-23 | User-directed | Codex | Implement Phase 2 token and compliance; tests and review | User's Phase 2 requirements, spec v1, existing contracts/configuration, installed OpenZeppelin source | Token implementation and executable validation; later phases excluded; no commits requested | AUD-004; partial follow-up to AUD-001/AUD-003 | [Session summary (not verbatim)](phase2-session.md), [original request](../spec/phase2-requirements.md) |
