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
// Decision D10: Hardhat's published development keys and test seed phrase are
// redacted too. Keys are matched by SHA-256, so this file never contains them.
//
// Node, not Python: the project already requires Node, while `python3` is a
// non-working Store stub on Windows (audit-1 F-01). Always exits 0 so it can
// never block Claude Code.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A 64-hex run not inside a longer hex run, with an optional 0x prefix.
const HEX64 = /(?<![0-9A-Fa-f])(0x)?([0-9A-Fa-f]{64})(?![0-9A-Fa-f])/g;
// Hardhat's default seed phrase: eleven "test" words and then "junk".
const DEV_PHRASE = /\btest(?:\s+test){10}\s+junk\b/gi;
// SHA-256 of the lowercase hex (no 0x) of Hardhat's 20 default accounts' private keys.
const DEV_KEY_SHA256 = new Set([
  "bc1a50966c9e6486bc4ebf880b51611a2a97fcb8e7a6976e9b81a9e3e8ca0e3c", "8335c55334821eefd4334369ff9c04a8594f161013cf9d87f58802d87297837e",
  "b26ab6529d20ebebb4192256f202984754f785481c64b1a1aed58cac93b3617e", "64034b44c579b335ab5e85debbfe72789e970138cc8d296799c3833a2a8525fb",
  "4d3e46eec8244d1d106f866ee48994f6176705298aee1b8426b2ad2529eb454b", "0aedba9d586f34f95cf1f0d54926f62e8a078ce2ca593be73ab27a87d3ff9c5d",
  "28e543d3753fc9d14c658ebef20b76a3b5f8e7d78667baf27832ceb3bea01bdf", "f070994a8599478580678f2b9482c5f02bb3de0647281e8efae183669425808a",
  "38e69fdd19aefeb4adf56312f10e62c30274997835173c7006308323ad7db506", "967f21586cdf1248a862f2cfb330099701c942c2c7a7537c54f7ec48f8556505",
  "0b33e0132123e78d42dd12a0fbbbacd19827d35ca88e0ad4ba83a47a65ba0487", "84bc109b3d59b0173a76fc3d831360a6e5063b3d4c82793a97de992947a0e3a8",
  "85bde548053aab4b5a6c78473d5eb2addaa5824299ad009bf06775e3ce923010", "f1513114f60e5e95732b840669fe83956d8a944d23e6c76f953e7edcf2491901",
  "5330d388af894c9e1a181a06a3ce44d61fd8602165d979942be4641f4002762f", "a2e06155cb1a424f972c3abfaddc9cea4820c4aec722d2378903fe28dd8fc40c",
  "4a67d7a0d8a16d6d954cef19eb5afdbdd82cc0e907a571f376ef0a0981a2a9d4", "b08bdfde9930d9202809530dcbe193c53fd0dc6928f2010d2ffca74df95ead36",
  "cf1fc66f853151a4c6666909c8f1f80e1d855ecffefbcb65a709aae544de5588", "100546a8b020a55aa09b2d34b50de9a3fc45a70b261aec6a989bb2d9321af583",
]);

function isDevKey(hex) {
  return DEV_KEY_SHA256.has(createHash("sha256").update(hex.toLowerCase()).digest("hex"));
}

function redact(text) {
  return text
    .replace(EMAIL, (m) => (m.endsWith("@users.noreply.github.com") ? m : "[email-redacted]"))
    .replace(HEX64, (m, _prefix, hex) => (isDevKey(hex) ? "[hardhat-dev-key-redacted]" : m))
    .replace(DEV_PHRASE, "[hardhat-dev-mnemonic-redacted]");
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
