// WCAG AA (4.5:1 for text) for every foreground/background pair the UI uses.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");
const token = (name: string) => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing colour token --${name}`);
  return match[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("Design token contrast", () => {
  it.each([
    ["color-ink", "color-bg"],
    ["color-ink", "color-surface"],
    ["color-ink-2", "color-surface"],
    ["color-ink-2", "color-bg"],
    ["color-ink-3", "color-surface"],
    ["color-ink-3", "color-bg"],
    ["color-ink-3", "color-surface-muted"],
    ["color-accent", "color-surface"],
    ["color-accent", "color-accent-subtle"],
    ["color-on-accent", "color-accent"],
    ["color-on-accent", "color-accent-hover"],
    ["color-ok", "color-ok-bg"],
    ["color-warn", "color-warn-bg"],
    ["color-err", "color-err-bg"],
    ["color-ok", "color-surface"],
    ["color-warn", "color-surface"],
    ["color-err", "color-surface"],
  ])("%s on %s meets 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
