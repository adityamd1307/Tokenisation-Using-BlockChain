# AI logs

Evidence for Report Sections 2, 3 and 8: which AI tools we used, what we gave them, and what came back.

## What is captured automatically

Claude Code sessions started inside this repo are copied into `raw/` by the hook in `.claude/hooks/archive_transcript.mjs`. It runs after every turn and when the session ends. `sessions.tsv` lists each session with the git user who ran it.

History of the hook:
- Until 23 October 2026 the hook ran `python3`. On Windows that is a Microsoft Store stub that does nothing, so no transcript was ever archived (audit-1 finding F-01).
- It now runs on `node`, which the project already requires.
- The three sessions that existed by then (Phase 1 setup, Phase 3, audit 1) were archived by running the hook by hand. Their `first_seen_utc` in `sessions.tsv` is therefore the archive time, not the session start.
- The Phase 2 Codex session ran outside Claude Code. No verbatim log of it is held; see `phase2-session.md`.

**Redaction.** The copies in `raw/` are verbatim except for one mechanical rule, applied by the hook: every email address is replaced with `[email-redacted]`. GitHub `@users.noreply.github.com` addresses are left alone, because they are already public in the commit history. This keeps team members' personal and work addresses out of a public repository. It is the only exception to "do not edit transcripts" below.

Claude Code only keeps its own transcripts for a limited time, so the copies in `raw/` are the record we rely on. Commit them.

The raw files are JSONL in Claude Code's internal format, which can change between versions. They are the record, not something to read. For the report, use the readable exports below.

## What you do by hand

1. **Name sessions** so they are easy to find: start Claude Code with `claude -n <topic>`, e.g. `claude -n token-contract-gen`.
2. **Export important sessions** before ending them: run `/export docs/ai-logs/exports/<yyyy-mm-dd>-<topic>.txt`. Do this for any session that generated code, changed the spec, or found a bug.
3. **Log other AI tools** (claude.ai chats, ChatGPT, Copilot, Cursor): save or copy the conversation into `exports/` and add a row to `INDEX.md`.
4. **Add an INDEX row** for every session that mattered. Skip trivial ones.

## Rules

- Never paste private keys, RPC URLs with keys, or API keys into any AI tool. These files are committed.
- Do not edit transcripts after the fact. If a session went badly, that is evidence too.
