import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { explorerUrl } from "../../config/networks";
import { eth, shortAddress, units } from "../../utils/formatting";

/**
 * An address or transaction hash: truncated (0x1234…abcd) in mono, full value on
 * hover, copy to clipboard, and an explorer link where the network has one.
 */
export function Address({
  value,
  kind = "address",
  full = false,
  tag,
}: {
  value: string;
  kind?: "address" | "tx";
  full?: boolean;
  tag?: string;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const url = explorerUrl(kind, value);
  const text = full ? value : shortAddress(value);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 1600);
  };
  return (
    <span className={`address${full ? " address--full" : ""}`}>
      {url ? (
        <a
          className="address__text mono"
          href={url}
          target="_blank"
          rel="noreferrer"
          title={value}
        >
          {text}
          <ExternalLink aria-hidden />
          <span className="visually-hidden"> (opens block explorer)</span>
        </a>
      ) : (
        <span className="address__text mono" title={value}>
          {text}
        </span>
      )}
      {tag && <span className="tag">{tag}</span>}
      <button
        type="button"
        className="icon-btn icon-btn--xs"
        aria-label={`Copy ${kind === "tx" ? "transaction hash" : "address"} ${value}`}
        title={
          copied === "failed" ? `Copy failed. Full value: ${value}` : "Copy"
        }
        onClick={() => void copy()}
      >
        {copied === "done" ? <Check aria-hidden /> : <Copy aria-hidden />}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied === "done"
          ? "Copied"
          : copied === "failed"
            ? "Copy failed"
            : ""}
      </span>
    </span>
  );
}

/** Whole token units with the fund symbol. */
export function Units({ value, symbol }: { value: bigint; symbol: string }) {
  return (
    <span className="amount">
      <span className="amount__value">{units(value)}</span>{" "}
      <span className="amount__unit">{symbol}</span>
    </span>
  );
}

/** An ETH amount with fixed decimals and its unit. */
export function Eth({ value }: { value: bigint }) {
  return (
    <span className="amount">
      <span className="amount__value">{eth(value)}</span>{" "}
      <span className="amount__unit">ETH</span>
    </span>
  );
}

export type Tone = "ok" | "warn" | "err" | "neutral" | "accent";
export function Pill({
  tone,
  children,
  plain = false,
}: {
  tone: Tone;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <span className={`pill pill--${tone}${plain ? " pill--plain" : ""}`}>
      {children}
    </span>
  );
}

export function Skeleton({ short = false }: { short?: boolean }) {
  return (
    <span
      className={`skeleton${short ? " skeleton--short" : ""}`}
      aria-hidden
    />
  );
}

/** A fund factsheet: label/value rows in a definition list. */
export function Facts({
  items,
  compact = false,
  label,
}: {
  items: { label: string; value: ReactNode }[];
  compact?: boolean;
  label?: string;
}) {
  return (
    <dl
      className={`facts${compact ? " facts--compact" : ""}`}
      aria-label={label}
    >
      {items.map((item) => (
        <FactRow key={item.label} {...item} />
      ))}
    </dl>
  );
}
function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** One row of key figures separated by hairlines (not a grid of cards). */
export function Figures({
  items,
  label,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[];
  label: string;
}) {
  return (
    <section className="figures" aria-label={label}>
      {items.map((item) => (
        <div className="figure" key={item.label}>
          <span className="figure__label">{item.label}</span>
          <span className="figure__value">{item.value}</span>
          {item.note && <span className="figure__note">{item.note}</span>}
        </div>
      ))}
    </section>
  );
}
