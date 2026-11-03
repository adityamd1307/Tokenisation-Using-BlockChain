> Phase 4 update (28 October 2026): the current reproducible setup is in [README.md](README.md) and [the Phase 4 workflow](docs/phase4-implementation.md#reproducible-local-workflow). This file retains historical Phase 1 setup notes; use the current instructions for persistent localhost deployment, ABI sync, and frontend tests.

# Setting up the evidence pipeline

Do the steps in order. Step 2 has to happen before any AI tool touches the repo.

## 0. Installs (each teammate, once)

- Git and Python 3.8 or newer
- Foundry: `curl -L https://foundry.paradigm.xyz | bash`, then `foundryup`
- Slither: `python3 -m pip install slither-analyzer`
- Your git name, which is recorded on every evidence run and AI session: `git config --global user.name "Your Name"`

If `python3` is not the command for Python on your machine, change the two `"python3"` entries in `.claude/settings.json`.

## 1. Create the repo

Make it a **private** GitHub repo. AI transcripts are committed, and they can contain anything that was typed into a session. Clone it.

## 2. Commit spec v0 first, on its own

Unzip this kit into the repo root. Fill in "Date written" and "Written by" in `docs/spec/spec-v0.md`. Then:

```bash
git add docs/spec/spec-v0.md
git commit -m "docs: spec v0 (pre-AI proposal)"
git tag spec-v0
git add -A
git commit -m "chore: evidence pipeline"
git push --follow-tags
```

Be honest about what this proves. Git commit dates can be set to anything, so the tag alone is weak evidence. The strong evidence is the date you submitted the BYOP proposal to the coordinator, so put that date in the file.

## 3. Log today's research chat

Copy the claude.ai conversation from 23 Oct 2026 into `docs/ai-logs/exports/2026-10-23-claude-ai-research.md`. Its row in `docs/ai-logs/INDEX.md` is already filled in.

## 4. Start Claude Code and check the hook

From the repo root run `claude -n toolchain-setup`. Accept the trust prompt for the folder if one appears. Run `/hooks`: it should list a `Stop` hook and a `SessionEnd` hook from project settings. After Claude's first reply, `docs/ai-logs/raw/` should contain a `.jsonl` file. If it doesn't, stop and fix that first, because every session before the fix is lost evidence.

## 5. Paste this prompt into Claude Code

```text
Read CLAUDE.md first. Set up the Foundry toolchain for this repo. Do not write any contract code: spec-v1 is not frozen.

1. Check that forge and slither are installed (forge --version, slither --version). If either is missing, stop and tell me. Don't install them yourself.
2. Run `forge init --force` in the repo root. Then run `git status` and make sure it did not change .gitignore, CLAUDE.md, SETUP.md, slither.config.json, or anything under docs/, scripts/ or .claude/. Restore anything it changed.
3. Install OpenZeppelin Contracts pinned to the latest v5.x release tag. Find the tag with `git ls-remote --tags https://github.com/OpenZeppelin/openzeppelin-contracts`, then `forge install OpenZeppelin/openzeppelin-contracts@<tag>`. Write remappings with `forge remappings > remappings.txt`.
4. Make the scripts executable: chmod +x scripts/*.sh .claude/hooks/archive_transcript.py
5. Run `scripts/evidence.sh pipeline-check` and show me summary.txt. build, test, gas and coverage should exit 0. Slither exits non-zero only if it reports findings.
6. Delete src/Counter.sol, test/Counter.t.sol and script/Counter.s.sol so the AI baseline starts from an empty src/.
7. Commit everything as "chore: foundry toolchain and OpenZeppelin <tag>". Do not push.

Then tell me what you did and anything that did not go as described.
```

## 6. After the session

Run `/export docs/ai-logs/exports/<date>-toolchain-setup.txt` before you quit. Add a row to `docs/ai-logs/INDEX.md`. Commit and push.

## Later: creating the AI baseline

Once `spec-v1.md` has no `TODO(decision)` left, generate the first full version of the contracts on its own branch and freeze it:

```bash
git switch -c ai-baseline
# ...AI generates the code; commit it as-is with an "ai:" prefix...
git tag ai-baseline
git switch main
git merge ai-baseline
```

All review and fixes happen on `main`. `ai-baseline` is never edited again; it is your Report Section 4 and the "before" for every issue.

## Notes

- `forge init` also adds a GitHub Actions workflow in `.github/workflows/`. Keep it. CI runs on GitHub's servers give you timestamped test results that nobody on the team can edit. Its `forge fmt --check` step will fail on unformatted code; run `forge fmt` before pushing.
- Slither does not catch everything. In testing this kit, a function that let anyone whitelist themselves passed Slither with no warning; only a unit test caught it. Tests are the main line of defence and Slither is a supplement.
