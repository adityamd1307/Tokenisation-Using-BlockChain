import {
  getAddress,
  isAddress,
  MaxUint256,
  parseEther,
  ZeroAddress,
} from "ethers";

export function address(value: string): string {
  const trimmed = value.trim();
  if (!isAddress(trimmed) || trimmed.toLowerCase() === ZeroAddress)
    throw new Error("Enter a valid, nonzero Ethereum address.");
  return getAddress(trimmed);
}
export function quantity(value: string): bigint {
  if (!/^[0-9]+$/.test(value.trim()))
    throw new Error("Quantity must be a positive whole number.");
  const result = BigInt(value.trim());
  if (result <= 0n || result > MaxUint256)
    throw new Error("Quantity must be a positive whole number within uint256.");
  return result;
}
export function priceWei(value: string): bigint {
  if (!/^(?:\d+)(?:\.\d{1,18})?$/.test(value.trim()))
    throw new Error(
      "Enter a positive ETH price with at most 18 decimal places.",
    );
  const result = parseEther(value.trim());
  if (result <= 0n || result > MaxUint256)
    throw new Error("Token price must be positive and within uint256.");
  return result;
}
export function payment(amount: bigint, price: bigint): bigint {
  const value = amount * price;
  if (amount <= 0n || price <= 0n || value > MaxUint256)
    throw new Error("Invalid quantity or payment exceeds uint256.");
  return value;
}
export interface CreateAssetInput {
  name: string;
  symbol: string;
  description: string;
  category: string;
  supply: string;
  price: string;
}
export function creationArgs(input: CreateAssetInput) {
  if (!input.name.trim() || !input.symbol.trim())
    throw new Error("Asset name and symbol are required.");
  if (!["0", "1"].includes(input.category))
    throw new Error("Select a supported asset category.");
  return [
    input.name.trim(),
    input.symbol.trim(),
    input.description.trim(),
    Number(input.category),
    quantity(input.supply),
    priceWei(input.price),
  ] as const;
}
