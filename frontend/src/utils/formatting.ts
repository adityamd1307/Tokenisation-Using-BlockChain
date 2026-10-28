import { formatEther } from "ethers";
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export const units = (value: bigint) => value.toLocaleString("en-US");
export const eth = (value: bigint) => formatEther(value);
export const categoryName = (category: number) =>
  category === 0 ? "Real-world asset" : "Digital asset";
