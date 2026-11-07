const WEI = 10n ** 18n;

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

/** Whole token units (decimals() is 0), with thousands separators. */
export const units = (value: bigint) => value.toLocaleString("en-US");

/**
 * ETH with thousands separators and at least `minDecimals` fixed decimals.
 * Extra decimals are kept rather than rounded, so no amount is misstated.
 */
export function eth(value: bigint, minDecimals = 4) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const fraction = (abs % WEI)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "")
    .padEnd(minDecimals, "0");
  const whole = (abs / WEI).toLocaleString("en-US");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export const categoryName = (category: number) =>
  category === 0 ? "Real-world asset" : "Digital asset";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
/** Block timestamp (seconds) as "07 Nov 2026, 14:32" in local time. */
export const formatTime = (seconds: number) =>
  dateTime.format(new Date(seconds * 1000));
