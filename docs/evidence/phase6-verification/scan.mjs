// Secret/privacy scan. Prints counts and file:line locations only, never matched values.
// Usage: node scan.mjs <repoRoot> <fileListPath> [--hook <path to archive_transcript.mjs>]
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const [root, listPath] = process.argv.slice(2);
const hookIdx = process.argv.indexOf("--hook");
const hookPath = hookIdx > 0 ? process.argv[hookIdx + 1] : path.join(root, ".claude/hooks/archive_transcript.mjs");

// Dev-key hashes are read from the hook so this script holds no key material either.
const hook = fs.readFileSync(hookPath, "utf8");
const setBlock = hook.slice(hook.indexOf("DEV_KEY_SHA256"), hook.indexOf("]);", hook.indexOf("DEV_KEY_SHA256")));
const DEV = new Set(setBlock.match(/[0-9a-f]{64}/g));
if (DEV.size !== 20) throw new Error(`expected 20 dev-key hashes, got ${DEV.size}`);

const require = createRequire(path.join(root, "package.json"));
const { LangEn } = require("ethers");
const wl = LangEn.wordlist();
const BIP39 = new Set(Array.from({ length: 2048 }, (_, i) => wl.getWord(i)));

const checks = {
  devKey: (line) => [...line.matchAll(/(?<![0-9A-Fa-f])(?:0x)?([0-9A-Fa-f]{64})(?![0-9A-Fa-f])/g)]
    .filter((m) => DEV.has(createHash("sha256").update(m[1].toLowerCase()).digest("hex"))).length,
  devPhrase: (line) => (line.match(/\btest(?:\s+test){10}\s+junk\b/gi) || []).length,
  bip39Run12: (line) => {
    let run = 0, hits = 0;
    for (const w of line.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
      if (BIP39.has(w)) { run++; if (run === 12) hits++; } else run = 0;
    }
    return hits;
  },
  emailNonNoreply: (line) => (line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .filter((e) => !e.endsWith("@users.noreply.github.com") && !/@(example\.(com|org)|[0-9.]+)$/.test(e)
      && !/\.(png|svg|js|ts|json|css)$/i.test(e) && !/^[^@]+@\d/.test(e)).length,
  keyedRpcUrl: (line) => (line.match(/(infura\.io\/v3\/|alchemy(api)?\.(io|com)\/v2\/|g\.alchemy\.com\/v2\/|quiknode\.pro\/|ankr\.com\/[a-z_]+\/|drpc\.org\/[^\s"']*dkey=|blastapi\.io\/|chainstack\.com\/)[A-Za-z0-9_-]{12,}/gi) || []).length,
  urlKeyParam: (line) => (line.match(/[?&](api[-_]?key|apikey|key|token|access_token)=[A-Za-z0-9_-]{16,}/gi) || []).length,
  apiKeyShape: (line) => (line.match(/\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|gho_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[abposr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{36})\b/g) || []).length,
  envAssign: (line) => (line.match(/\b(PRIVATE_KEY|SEPOLIA_[A-Z_]*KEY|ETHERSCAN_API_KEY|RPC_URL|MNEMONIC)\s*[=:]\s*["']?(?!\$|<|\[|process|env|""|''|\s*$)[^\s"'`,)]{8,}/g) || []).length,
  nonDevHex64NearKey: (line) => /priv(ate)?[_ -]?key|secret|mnemonic/i.test(line)
    ? [...line.matchAll(/(?<![0-9A-Fa-f])(?:0x)?([0-9A-Fa-f]{64})(?![0-9A-Fa-f])/g)]
        .filter((m) => !DEV.has(createHash("sha256").update(m[1].toLowerCase()).digest("hex"))).length : 0,
  absPathWin: (line) => (line.match(/\b[A-Za-z]:(\\\\|\\|\/)(Users|Documents and Settings)(\\\\|\\|\/)/g) || []).length,
  absPathUnix: (line) => (line.match(/(?<![\w.])\/(home|Users)\/[A-Za-z0-9._-]+/g) || []).length,
  oneDriveOrg: (line) => (line.match(/OneDrive - [A-Za-z]/g) || []).length,
};
const userNames = (process.env.SCAN_USERNAMES || "").split(",").filter(Boolean);
if (userNames.length) checks.username = (line) => userNames.reduce((n, u) => n + (line.toLowerCase().split(u.toLowerCase()).length - 1), 0);

const files = fs.readFileSync(listPath, "utf8").split(/\r?\n/).filter(Boolean);
const totals = Object.fromEntries(Object.keys(checks).map((k) => [k, 0]));
const where = Object.fromEntries(Object.keys(checks).map((k) => [k, {}]));
for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [k, fn] of Object.entries(checks)) {
      const n = fn(line);
      if (n) { totals[k] += n; (where[k][f] ||= []).push(i + 1); }
    }
  });
}
console.log(`files scanned: ${files.length}`);
for (const k of Object.keys(checks)) {
  console.log(`${k}: ${totals[k]}`);
  for (const [f, ls] of Object.entries(where[k]))
    console.log(`   ${f}: ${ls.length} line(s) [${ls.slice(0, 8).join(",")}${ls.length > 8 ? ",..." : ""}]`);
}
