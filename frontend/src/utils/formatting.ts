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

/** All event, offering and identity timestamps use Singapore time. */
export { formatSingaporeTime as formatTime } from "./time";
