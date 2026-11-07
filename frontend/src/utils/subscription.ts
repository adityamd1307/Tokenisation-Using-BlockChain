import { parseSingaporeDateTime } from "./time";
import { formatUnits, MaxUint256, parseUnits } from "ethers";
export const offeringStatuses = [
  "Upcoming",
  "Subscription Open",
  "Awaiting Finalisation",
  "Successful",
  "Failed",
] as const;

export function musd(value: bigint): string {
  return formatUnits(value, 6).replace(/\.0$/, "");
}

export function parseUSD(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim()))
    throw new Error("Enter mUSD with at most six decimal places.");
  const amount = parseUnits(value.trim(), 6);
  if (amount <= 0n || amount > MaxUint256)
    throw new Error("Enter a positive mUSD amount within the token limit.");
  return amount;
}

// Financial ratio remains integer-based; CSS percentage conversion is presentation only.
export function demandPercent(demand: bigint, cap: bigint): string {
  if (cap === 0n) return "0.00";
  const hundredths = (demand * 10000n) / cap;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

export interface OfferingInput {
  supply: string;
  price: string;
  softCap: string;
  start: string;
  end: string;
}
export function offeringArgs(input: OfferingInput, now: bigint) {
  if (!/^[1-9]\d*$/.test(input.supply))
    throw new Error("Supply must be a positive whole number.");
  const supply = BigInt(input.supply),
    price = parseUSD(input.price),
    softCap = parseUSD(input.softCap);
  if (supply > MaxUint256 / price)
    throw new Error("Offering hard cap exceeds the token limit.");
  const startMs = parseSingaporeDateTime(input.start),
    endMs = parseSingaporeDateTime(input.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
    throw new Error("Choose valid subscription dates.");
  const start = BigInt(Math.floor(startMs / 1000)),
    end = BigInt(Math.floor(endMs / 1000));
  if (start <= now || end <= start)
    throw new Error("Start must be in the future and end must follow start.");
  if (softCap > supply * price)
    throw new Error("Soft cap cannot exceed supply × price.");
  return [supply, price, softCap, start, end] as const;
}
