# AI logs

Evidence for Report Sections 2, 3 and 8: which AI tools we used, what we gave them, and what came back.

## What is captured automatically

Claude Code sessions started inside this repo are copied into `raw/` by the hook in `.claude/hooks/archive_transcript.py`. It runs after every turn and when the session ends. `sessions.tsv` lists each session with the git user who ran it.

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
