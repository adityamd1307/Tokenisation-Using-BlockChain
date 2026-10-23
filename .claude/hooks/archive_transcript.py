#!/usr/bin/env python3
"""Copy the current Claude Code transcript into docs/ai-logs/raw/.

Claude Code runs this on Stop (after every turn, in the background) and on
SessionEnd. It reads the hook's JSON input from stdin, copies the session's
transcript file into the repo, and records the session in sessions.tsv the
first time it sees it. Claude Code deletes its own copy of old transcripts,
so this copy is the one we keep.

It always exits 0 so it can never block Claude Code.
"""
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys


def git_user(root):
    try:
        out = subprocess.run(
            ["git", "config", "user.name"],
            cwd=root, capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    src = data.get("transcript_path")
    session_id = data.get("session_id") or "unknown"
    if not src or not os.path.isfile(src):
        return

    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    raw_dir = pathlib.Path(root, "docs", "ai-logs", "raw")
    raw_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(raw_dir.glob(f"*_{session_id}.jsonl"))
    if existing:
        dest = existing[0]
    else:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        dest = raw_dir / f"{stamp}_{session_id}.jsonl"

    shutil.copyfile(src, dest)

    if not existing:
        tsv = raw_dir.parent / "sessions.tsv"
        new_file = not tsv.exists()
        with open(tsv, "a", encoding="utf-8") as f:
            if new_file:
                f.write("first_seen_utc\tsession_id\tgit_user\ttranscript\n")
            f.write(f"{dest.name.split('_')[0]}\t{session_id}\t{git_user(root)}\traw/{dest.name}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
