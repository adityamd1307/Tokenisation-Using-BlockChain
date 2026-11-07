// Check relative Markdown links and backticked repo paths resolve. Usage: node links.mjs <repoRoot> <file.md>...
import fs from "node:fs";
import path from "node:path";
const [root, ...files] = process.argv.slice(2);
let broken = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), "utf8");
  const dir = path.dirname(path.join(root, f));
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  const ticks = [...text.matchAll(/`((?:docs|test|scripts|contracts|frontend|\.claude)\/[^`*\s]+)`/g)].map((m) => m[1]);
  for (const l of links) {
    if (/^(https?:|mailto:|#)/.test(l)) continue;
    const target = decodeURIComponent(l.split("#")[0]);
    if (!target) continue;
    if (!fs.existsSync(path.resolve(dir, target))) { broken++; console.log(`${f}: broken link -> ${l}`); }
  }
  for (const t of ticks) {
    const clean = t.replace(/[.,;:]+$/, "");
    if (/[<>{}]|NNN|\.\.\.|…/.test(clean)) continue;
    if (!fs.existsSync(path.join(root, clean)) && !fs.existsSync(path.resolve(dir, clean))) { broken++; console.log(`${f}: missing path \`${clean}\``); }
  }
}
console.log(`broken: ${broken}`);
