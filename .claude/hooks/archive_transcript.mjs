// Copy the current Claude Code transcript into docs/ai-logs/raw/.
//
// Claude Code runs this on Stop (after every turn, in the background) and on
// SessionEnd. It reads the hook's JSON input from stdin, copies the session's
// transcript file into the repo, and records the session in sessions.tsv the
// first time it sees it. Claude Code deletes its own copy of old transcripts,
// so this copy is the one we keep.
//
// Email addresses are redacted in the copy (see docs/ai-logs/README.md), except
// GitHub noreply addresses, which are already public in the commit history.
//
// Node, not Python: the project already requires Node, while `python3` is a
// non-working Store stub on Windows (audit-1 F-01). Always exits 0 so it can
// never block Claude Code.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function redact(text) {
  return text.replace(EMAIL, (m) => (m.endsWith("@users.noreply.github.com") ? m : "[email-redacted]"));
}

function gitUser(root) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd: root, encoding: "utf8", timeout: 5000 }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function archive(data) {
  const src = data.transcript_path;
  const sessionId = data.session_id || "unknown";
  if (!src || !fs.existsSync(src)) return;

  const root = process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd();
  const rawDir = path.join(root, "docs", "ai-logs", "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const existing = fs.readdirSync(rawDir).filter((f) => f.endsWith(`_${sessionId}.jsonl`)).sort();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const name = existing[0] ?? `${stamp}_${sessionId}.jsonl`;

  fs.writeFileSync(path.join(rawDir, name), redact(fs.readFileSync(src, "utf8")));

  if (existing.length === 0) {
    const tsv = path.join(rawDir, "..", "sessions.tsv");
    if (!fs.existsSync(tsv)) fs.writeFileSync(tsv, "first_seen_utc\tsession_id\tgit_user\ttranscript\n");
    fs.appendFileSync(tsv, `${name.split("_")[0]}\t${sessionId}\t${gitUser(root)}\traw/${name}\n`);
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try {
    archive(JSON.parse(input.replace(/^﻿/, "")));
  } catch {}
  process.exit(0);
});
